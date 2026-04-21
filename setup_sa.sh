#!/bin/bash
gcloud projects add-iam-policy-binding optimal-transit-447015-e9 \
  --member="serviceAccount:nagoya-bites-sa@optimal-transit-447015-e9.iam.gserviceaccount.com" \
  --role="roles/editor"

gcloud iam service-accounts keys create \
  ~/Desktop/nagoya-bites/service-account.json \
  --iam-account=nagoya-bites-sa@optimal-transit-447015-e9.iam.gserviceaccount.com
