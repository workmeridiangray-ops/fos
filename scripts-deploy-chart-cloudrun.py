#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Flames of Shiva contributors
"""Deploy the isolated calculation service; never print or persist its secret."""
import argparse
import io
import tarfile
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import urllib.request

root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--project', default='meridian-gray')
parser.add_argument('--region', default='asia-south1')
parser.add_argument('--gcloud', default=shutil.which('gcloud'))
parser.add_argument('--license-ready', action='store_true', help='Owner has fulfilled the chosen engine AND Python binding licence requirements')
parser.add_argument('--connect-worker', action='store_true', help='Apply the website migration, deploy this Worker, and set its backend-only chart secrets')
a = parser.parse_args()
if not a.gcloud:
    parser.error('Install Google Cloud CLI, or provide --gcloud /absolute/path/to/gcloud')
if not a.license_ready:
    parser.error('Read chart-service/NOTICE.md and complete the licence route before using --license-ready. This flag does not itself satisfy a licence.')

def cloud(*args, capture=False, data=None, check=True):
    return subprocess.run([a.gcloud, *args, '--project='+a.project, '--quiet'], input=data, text=True, capture_output=capture, check=check)

active = cloud('auth','list','--filter=status:ACTIVE','--format=value(account)',capture=True).stdout.strip()
if not active:
    raise SystemExit('No active Google login. Run gcloud auth login, then rerun this script.')
cloud('projects','describe',a.project,'--format=value(projectId)',capture=True)
# Do not activate an image whose complete source release is unavailable or differs.
source_archive='https://github.com/workmeridiangray-ops/fos/archive/refs/tags/kundli-agpl-v1.tar.gz'
try:
    with urllib.request.urlopen(source_archive,timeout=60) as response:
        source_bytes=response.read(50_000_001)
    if len(source_bytes)>50_000_000:
        raise ValueError('Source release exceeds expected size')
    with tarfile.open(fileobj=io.BytesIO(source_bytes),mode='r:gz') as archive:
        members=archive.getmembers()
        prefix=members[0].name.split('/')[0]+'/'
        released={m.name.removeprefix(prefix):archive.extractfile(m).read() for m in members if m.isfile()}
    critical_files=[p for folder in ['public','src','chart-service','migrations','third_party'] for p in (root/folder).rglob('*') if p.is_file() and not any(part in {'__pycache__','.pytest_cache','.venv'} for part in p.parts) and p.name!='.env' and not p.name.endswith('.pyc')]
    critical_files += [root/p for p in ['LICENSE','THIRD_PARTY_NOTICES.md','package.json','package-lock.json','wrangler.jsonc','Dockerfile','.dockerignore','scripts-build.js','scripts-deploy-chart-cloudrun.py']]
    for local in critical_files:
        relative=local.relative_to(root).as_posix()
        if relative not in released or hashlib.sha256(local.read_bytes()).digest()!=hashlib.sha256(released[relative]).digest():
            raise ValueError('Local deployment differs from published source: '+relative)
except Exception as exc:
    raise SystemExit('Publish and verify the exact kundli-agpl-v1 source release before deploying: '+str(exc))
billing=cloud('billing','projects','describe',a.project,'--format=value(billingEnabled)',capture=True).stdout.strip().lower()
if billing!='true':
    raise SystemExit('Billing is disabled for this project. Enable billing before deployment; no services were changed.')
cloud('services','enable','run.googleapis.com','cloudbuild.googleapis.com','artifactregistry.googleapis.com','secretmanager.googleapis.com')
account_name='chart-api-runtime'
account=f'{account_name}@{a.project}.iam.gserviceaccount.com'
if cloud('iam','service-accounts','describe',account,capture=True,check=False).returncode:
    cloud('iam','service-accounts','create',account_name,'--display-name=Flames of Shiva chart runtime')
secret_name='flames-chart-api-key'
if cloud('secrets','describe',secret_name,capture=True,check=False).returncode:
    cloud('secrets','create',secret_name,'--replication-policy=automatic','--data-file=-',data=secrets.token_urlsafe(48))
cloud('secrets','add-iam-policy-binding',secret_name,'--member=serviceAccount:'+account,'--role=roles/secretmanager.secretAccessor',capture=True)
cloud('run','deploy','chart-api','--source='+str(root/'chart-service'),'--region='+a.region,'--service-account='+account,'--allow-unauthenticated','--port=8080','--memory=1Gi','--cpu=1','--concurrency=2','--min-instances=0','--max-instances=2','--timeout=60','--set-env-vars=CHART_MAX_JOBS=2','--set-secrets=CHART_API_KEY='+secret_name+':latest')
url=cloud('run','services','describe','chart-api','--region='+a.region,'--format=value(status.url)',capture=True).stdout.strip()
if not url.startswith('https://'):
    raise SystemExit('Deployment did not return an HTTPS URL. Worker settings were not changed.')
with urllib.request.urlopen(url+'/health',timeout=30) as response:
    if not json.load(response).get('ok'):
        raise SystemExit('Cloud Run health check failed. Worker settings were not changed.')
print('Cloud Run health check passed:',url)
if a.connect_worker:
    npx=shutil.which('npx')
    if not npx:
        raise SystemExit('Install Node 24/npm before connecting the Worker.')
    env=os.environ|{'WRANGLER_SEND_METRICS':'false'}
    subprocess.run([npx,'wrangler','d1','migrations','apply','flames-of-shiva','--remote'],cwd=root,env=env,check=True)
    subprocess.run([npx,'wrangler','deploy'],cwd=root,env=env,check=True)
    # Secret Manager output remains only in process memory and Wrangler stdin.
    key=cloud('secrets','versions','access','latest','--secret='+secret_name,capture=True).stdout.strip()
    if not key:
        raise SystemExit('No chart key could be read. Worker settings were not changed.')
    subprocess.run([npx,'wrangler','secret','bulk'],input=json.dumps({'CHART_API_URL':url,'CHART_API_KEY':key}),text=True,cwd=root,env=env,check=True)
    print('Worker code, migration and chart credentials updated. Test a new chart through the signed-in website.')
else:
    print('Website settings were not changed. Rerun with --connect-worker when ready to connect it.')
