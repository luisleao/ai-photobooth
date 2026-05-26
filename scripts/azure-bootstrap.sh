#!/usr/bin/env bash
# Creates all Azure resources needed for ai-photobooth and wires up GitHub Actions OIDC auth.
# Run once from your local machine before the first deployment.
#
# Prerequisites: az CLI, gh CLI, docker
# Usage: OPENAI_API_KEY=sk-... ./scripts/azure-bootstrap.sh

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-ai-photobooth-lleao}"
LOCATION="${LOCATION:-eastus}"
ACR_NAME="${ACR_NAME:-aiphotobooth}"          # globally unique, lowercase, 5-50 chars
CONTAINER_APP_NAME="${CONTAINER_APP_NAME:-ai-photobooth}"
CONTAINER_APP_ENV="${CONTAINER_APP_ENV:-cae-ai-photobooth}"
IMAGE_NAME="ai-photobooth"
CREATED_BY="${CREATED_BY:-rikumar}"

# GitHub repo for OIDC trust (owner/repo)
GITHUB_REPO="${GITHUB_REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")}"

if [[ -z "$GITHUB_REPO" ]]; then
  echo "ERROR: Set GITHUB_REPO=owner/repo or run from inside the git repo with gh CLI authenticated."
  exit 1
fi

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "ERROR: Set OPENAI_API_KEY before running this script."
  exit 1
fi

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

echo "==> Using subscription: $SUBSCRIPTION_ID"
echo "==> GitHub repo: $GITHUB_REPO"

# ── Resource group ─────────────────────────────────────────────────────────────
echo "==> Creating resource group: $RESOURCE_GROUP"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --tags created_by="$CREATED_BY" -o none

# ── Azure Container Registry ───────────────────────────────────────────────────
echo "==> Creating ACR: $ACR_NAME"
az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled false \
  --tags created_by="$CREATED_BY" \
  -o none

# ── Initial image build & push ──────────────────────────────────────────────────
echo "==> Building and pushing initial image"
az acr login --name "$ACR_NAME"
FULL_IMAGE="$ACR_NAME.azurecr.io/$IMAGE_NAME:latest"
docker build --platform linux/amd64 -t "$FULL_IMAGE" .
docker push "$FULL_IMAGE"

# ── Log Analytics workspace (created explicitly so we can tag it) ───────────────
LOG_ANALYTICS_WORKSPACE="law-ai-photobooth"
echo "==> Creating Log Analytics workspace: $LOG_ANALYTICS_WORKSPACE"
az monitor log-analytics workspace create \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$LOG_ANALYTICS_WORKSPACE" \
  --location "$LOCATION" \
  --tags created_by="$CREATED_BY" \
  -o none

LOG_ANALYTICS_CUSTOMER_ID=$(az monitor log-analytics workspace show \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$LOG_ANALYTICS_WORKSPACE" \
  --query customerId -o tsv)

LOG_ANALYTICS_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$LOG_ANALYTICS_WORKSPACE" \
  --query primarySharedKey -o tsv)

# ── Container Apps environment ─────────────────────────────────────────────────
echo "==> Creating Container Apps environment: $CONTAINER_APP_ENV"
az containerapp env create \
  --name "$CONTAINER_APP_ENV" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --logs-workspace-id "$LOG_ANALYTICS_CUSTOMER_ID" \
  --logs-workspace-key "$LOG_ANALYTICS_KEY" \
  --tags created_by="$CREATED_BY" \
  -o none

# ── Container App ──────────────────────────────────────────────────────────────
echo "==> Creating Container App: $CONTAINER_APP_NAME"
az containerapp create \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$CONTAINER_APP_ENV" \
  --image "$FULL_IMAGE" \
  --registry-server "$ACR_NAME.azurecr.io" \
  --registry-identity system \
  --target-port 3000 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --env-vars \
      "OPENAI_API_KEY=secretref:openai-api-key" \
      "NODE_ENV=production" \
      "PORT=3000" \
  --secrets "openai-api-key=$OPENAI_API_KEY" \
  --tags created_by="$CREATED_BY" \
  -o none

# Grant the Container App's managed identity pull access to ACR
echo "==> Granting ACR pull permission to Container App identity"
APP_PRINCIPAL=$(az containerapp show \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query identity.principalId -o tsv)

ACR_ID=$(az acr show --name "$ACR_NAME" --query id -o tsv)

az role assignment create \
  --assignee "$APP_PRINCIPAL" \
  --role "AcrPull" \
  --scope "$ACR_ID" \
  -o none

# ── Service principal for GitHub Actions OIDC ─────────────────────────────────
echo "==> Creating service principal for GitHub Actions"
SP_NAME="sp-ai-photobooth-github"
SP_APP_ID=$(az ad app create --display-name "$SP_NAME" --query appId -o tsv)
az ad sp create --id "$SP_APP_ID" -o none

# Assign Contributor on resource group + AcrPush on ACR
RG_ID=$(az group show --name "$RESOURCE_GROUP" --query id -o tsv)
az role assignment create --assignee "$SP_APP_ID" --role Contributor --scope "$RG_ID" -o none
az role assignment create --assignee "$SP_APP_ID" --role AcrPush      --scope "$ACR_ID" -o none

# Federated credential for OIDC (main branch pushes)
az ad app federated-credential create \
  --id "$SP_APP_ID" \
  --parameters "{
    \"name\": \"github-main\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:${GITHUB_REPO}:ref:refs/heads/main\",
    \"audiences\": [\"api://AzureADTokenCredential\"]
  }" \
  -o none

# ── Store secrets in GitHub ────────────────────────────────────────────────────
echo "==> Setting GitHub Actions secrets"
gh secret set AZURE_CLIENT_ID       --repo "$GITHUB_REPO" --body "$SP_APP_ID"
gh secret set AZURE_TENANT_ID       --repo "$GITHUB_REPO" --body "$TENANT_ID"
gh secret set AZURE_SUBSCRIPTION_ID --repo "$GITHUB_REPO" --body "$SUBSCRIPTION_ID"

# ── Done ───────────────────────────────────────────────────────────────────────
APP_URL=$(az containerapp show \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query properties.configuration.ingress.fqdn -o tsv)

echo ""
echo "==> Bootstrap complete!"
echo ""
echo "  App URL:  https://$APP_URL"
echo ""
echo "  Next steps:"
echo "  1. Push to main to trigger the GitHub Actions workflow."
echo "  2. To add more env vars:  az containerapp update --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --set-env-vars KEY=value"
echo "  3. To scale:              az containerapp update --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --min-replicas 1 --max-replicas 5"
