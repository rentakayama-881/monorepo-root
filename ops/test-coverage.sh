#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Backend (Go) Test Coverage ==="
cd "$ROOT_DIR/backend"
go test -coverprofile=coverage.out -covermode=atomic ./... 2>&1 | tail -5
BACKEND_COV=$(go tool cover -func=coverage.out | grep total | awk '{print $3}')
echo "Backend coverage: $BACKEND_COV"
rm -f coverage.out
echo ""

echo "=== Feature Service (.NET) Test Coverage ==="
cd "$ROOT_DIR/feature-service"
dotnet test --collect:"XPlat Code Coverage" --results-directory ./coverage 2>&1 | tail -5
echo "(See ./coverage/ for detailed report)"
echo ""

echo "=== Frontend (Jest) Test Coverage ==="
cd "$ROOT_DIR/frontend"
npx jest --coverage --ci --forceExit 2>&1 | tail -10
echo ""

echo "=== Coverage Summary ==="
echo "Backend (Go):        $BACKEND_COV (target: >=60%)"
echo "Feature Service:     (see above, target: >=50%)"
echo "Frontend:            (see above, target: >=50%)"
