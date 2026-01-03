#!/bin/bash

# Passkey Debug Helper Script
# Membantu debug masalah passkey login

echo "=================================="
echo "🔍 Passkey Login Debug Helper"
echo "=================================="
echo ""

# Change to backend directory
cd "$(dirname "$0")/backend" || exit 1

echo "1️⃣ Checking .env file..."
if [ ! -f ".env" ]; then
    echo "❌ File .env tidak ditemukan!"
    echo "📝 Membuat .env template..."
    cat > .env << 'EOF'
# Copy dari .env.example dan sesuaikan

# WebAuthn / Passkey Configuration
# PENTING: Sesuaikan dengan domain frontend Anda!
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_ORIGIN=http://localhost:3000
WEBAUTHN_RP_NAME=Alephdraad

# Frontend URL
FRONTEND_BASE_URL=http://localhost:3000

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000

# Untuk Production, ganti dengan:
# WEBAUTHN_RP_ID=monorepo-root-dun.vercel.app
# WEBAUTHN_RP_ORIGIN=https://monorepo-root-dun.vercel.app
# FRONTEND_BASE_URL=https://monorepo-root-dun.vercel.app
# CORS_ALLOWED_ORIGINS=https://monorepo-root-dun.vercel.app
EOF
    echo "✅ Template .env sudah dibuat!"
    echo "⚠️  EDIT file .env dan sesuaikan dengan setup Anda!"
    echo ""
else
    echo "✅ File .env ditemukan"
    echo ""
fi

echo "2️⃣ Checking WebAuthn Configuration..."
echo "-----------------------------------"
WEBAUTHN_RP_ID=$(grep "^WEBAUTHN_RP_ID=" .env 2>/dev/null | cut -d= -f2)
WEBAUTHN_RP_ORIGIN=$(grep "^WEBAUTHN_RP_ORIGIN=" .env 2>/dev/null | cut -d= -f2)
WEBAUTHN_RP_NAME=$(grep "^WEBAUTHN_RP_NAME=" .env 2>/dev/null | cut -d= -f2)
FRONTEND_BASE_URL=$(grep "^FRONTEND_BASE_URL=" .env 2>/dev/null | cut -d= -f2)

if [ -z "$WEBAUTHN_RP_ID" ]; then
    echo "⚠️  WEBAUTHN_RP_ID tidak ditemukan (akan fallback ke 'localhost')"
else
    echo "✅ WEBAUTHN_RP_ID = $WEBAUTHN_RP_ID"
fi

if [ -z "$WEBAUTHN_RP_ORIGIN" ]; then
    echo "⚠️  WEBAUTHN_RP_ORIGIN tidak ditemukan (akan fallback ke FRONTEND_BASE_URL atau localhost:3000)"
else
    echo "✅ WEBAUTHN_RP_ORIGIN = $WEBAUTHN_RP_ORIGIN"
fi

if [ -z "$WEBAUTHN_RP_NAME" ]; then
    echo "⚠️  WEBAUTHN_RP_NAME tidak ditemukan (akan fallback ke 'Alephdraad')"
else
    echo "✅ WEBAUTHN_RP_NAME = $WEBAUTHN_RP_NAME"
fi

echo ""

echo "3️⃣ Validation Check..."
echo "-----------------------------------"

# Check if RP_ID matches domain from RP_ORIGIN
if [ ! -z "$WEBAUTHN_RP_ORIGIN" ] && [ ! -z "$WEBAUTHN_RP_ID" ]; then
    DOMAIN_FROM_ORIGIN=$(echo "$WEBAUTHN_RP_ORIGIN" | sed -E 's|https?://||' | sed 's|/.*||' | sed 's|:.*||')
    
    if [ "$WEBAUTHN_RP_ID" != "$DOMAIN_FROM_ORIGIN" ]; then
        if [ "$WEBAUTHN_RP_ID" != "localhost" ] || [ "$DOMAIN_FROM_ORIGIN" != "localhost" ]; then
            echo "⚠️  WARNING: RP_ID tidak match dengan domain di RP_ORIGIN"
            echo "   RP_ID       : $WEBAUTHN_RP_ID"
            echo "   RP_ORIGIN   : $WEBAUTHN_RP_ORIGIN"
            echo "   Domain      : $DOMAIN_FROM_ORIGIN"
            echo ""
            echo "   Seharusnya:"
            echo "   WEBAUTHN_RP_ID=$DOMAIN_FROM_ORIGIN"
            echo ""
        fi
    else
        echo "✅ RP_ID dan RP_ORIGIN match!"
    fi
fi

# Check if HTTPS is used for production domains
if [ ! -z "$WEBAUTHN_RP_ORIGIN" ]; then
    if [[ "$WEBAUTHN_RP_ORIGIN" == http://* ]] && [[ "$WEBAUTHN_RP_ORIGIN" != *"localhost"* ]] && [[ "$WEBAUTHN_RP_ORIGIN" != *"127.0.0.1"* ]]; then
        echo "⚠️  WARNING: Production domain menggunakan HTTP (harusnya HTTPS)"
        echo "   Passkey memerlukan HTTPS di production!"
        echo ""
    fi
fi

echo ""

echo "4️⃣ Checking Recent Logs..."
echo "-----------------------------------"
if [ -f "app" ] || [ -f "app.log" ]; then
    if [ -f "app.log" ]; then
        LOG_FILE="app.log"
    else
        LOG_FILE="app"
    fi
    
    echo "📄 Last 15 lines from $LOG_FILE (filtered passkey/error):"
    echo ""
    tail -100 "$LOG_FILE" 2>/dev/null | grep -i "passkey\|webauthn\|error\|panic" | tail -15 || echo "No relevant logs found"
else
    echo "ℹ️  Log file belum ada (backend belum pernah dijalankan)"
fi

echo ""
echo ""

echo "5️⃣ Quick Recommendations"
echo "-----------------------------------"
echo "✅ Pastikan sudah:"
echo "   1. Edit .env dengan config yang benar"
echo "   2. WEBAUTHN_RP_ORIGIN sama dengan URL frontend"
echo "   3. WEBAUTHN_RP_ID sama dengan domain (tanpa https://)"
echo "   4. Restart backend setelah ubah .env"
echo "   5. Clear browser cache atau gunakan Incognito"
echo ""
echo "🔄 Untuk restart backend:"
echo "   pkill -f 'go run main.go' && go run main.go"
echo ""
echo "📖 Dokumentasi lengkap: PASSKEY_FIX.md"
echo ""
echo "=================================="
