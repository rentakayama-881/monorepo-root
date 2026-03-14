/**
 * Feature Service response helpers.
 * Extracted from featureApi.js for modularity.
 */

export function unwrapFeatureData(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  if ("data" in payload) {
    return payload.data;
  }

  if ("Data" in payload) {
    return payload.Data;
  }

  if ("result" in payload) {
    return payload.result;
  }

  if ("Result" in payload) {
    return payload.Result;
  }

  return payload;
}

export function extractFeatureItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  if (Array.isArray(payload.Items)) {
    return payload.Items;
  }

  // Admin moderation paginated responses can use bans/Bans
  if (Array.isArray(payload.bans)) {
    return payload.bans;
  }

  if (Array.isArray(payload.Bans)) {
    return payload.Bans;
  }

  if (Array.isArray(payload.results)) {
    return payload.results;
  }

  if (Array.isArray(payload.Results)) {
    return payload.Results;
  }

  if (Array.isArray(payload.transfers)) {
    return payload.transfers;
  }

  if (Array.isArray(payload.Transfers)) {
    return payload.Transfers;
  }

  if (Array.isArray(payload.disputes)) {
    return payload.disputes;
  }

  if (Array.isArray(payload.Disputes)) {
    return payload.Disputes;
  }

  if (Array.isArray(payload.deposits)) {
    return payload.deposits;
  }

  if (Array.isArray(payload.Deposits)) {
    return payload.Deposits;
  }

  if (Array.isArray(payload.messages)) {
    return payload.messages;
  }

  if (Array.isArray(payload.Messages)) {
    return payload.Messages;
  }

  if (Array.isArray(payload.evidence)) {
    return payload.evidence;
  }

  if (Array.isArray(payload.Evidence)) {
    return payload.Evidence;
  }

  return [];
}

export function extractTotalCount(payload, fallbackLength) {
  if (payload && typeof payload === "object") {
    if (typeof payload.totalCount === "number") {
      return payload.totalCount;
    }

    if (typeof payload.TotalCount === "number") {
      return payload.TotalCount;
    }

    if (typeof payload.total === "number") {
      return payload.total;
    }

    if (typeof payload.Total === "number") {
      return payload.Total;
    }
  }

  return fallbackLength;
}
