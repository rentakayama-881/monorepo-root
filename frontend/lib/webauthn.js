// Helper to convert ArrayBuffer to Base64URL
export function bufferToBase64URL(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Helper to convert Base64URL to ArrayBuffer
export function base64URLToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function serializePublicKeyCredential(credential) {
  const response = credential.response;
  const responseData = {
    clientDataJSON: bufferToBase64URL(response.clientDataJSON),
  };

  if ("attestationObject" in response) {
    responseData.attestationObject = bufferToBase64URL(response.attestationObject);
    if (response.getTransports) {
      responseData.transports = response.getTransports();
    }
  }

  if ("authenticatorData" in response) {
    responseData.authenticatorData = bufferToBase64URL(response.authenticatorData);
    responseData.signature = bufferToBase64URL(response.signature);
    if (response.userHandle) {
      responseData.userHandle = bufferToBase64URL(response.userHandle);
    }
  }

  return {
    id: credential.id,
    rawId: bufferToBase64URL(credential.rawId),
    type: credential.type,
    response: responseData,
    clientExtensionResults: credential.getClientExtensionResults
      ? credential.getClientExtensionResults()
      : {},
    authenticatorAttachment: credential.authenticatorAttachment ?? null,
  };
}
