#!/usr/bin/env bash
set -euo pipefail

ensure_ipv4() {
  iptables -N HARDEN_BASE 2>/dev/null || true
  iptables -F HARDEN_BASE

  iptables -A HARDEN_BASE -i lo -j ACCEPT
  iptables -A HARDEN_BASE -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
  iptables -A HARDEN_BASE -p tcp --dport 22 -j ACCEPT
  iptables -A HARDEN_BASE -p tcp --dport 80 -j ACCEPT
  iptables -A HARDEN_BASE -p tcp --dport 443 -j ACCEPT
  iptables -A HARDEN_BASE -j DROP

  while iptables -C INPUT -j HARDEN_BASE 2>/dev/null; do
    iptables -D INPUT -j HARDEN_BASE
  done
  iptables -I INPUT 1 -j HARDEN_BASE
}

ensure_ipv6() {
  ip6tables -N HARDEN6_BASE 2>/dev/null || true
  ip6tables -F HARDEN6_BASE

  ip6tables -A HARDEN6_BASE -i lo -j ACCEPT
  ip6tables -A HARDEN6_BASE -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
  ip6tables -A HARDEN6_BASE -p tcp --dport 22 -j ACCEPT
  ip6tables -A HARDEN6_BASE -p tcp --dport 80 -j ACCEPT
  ip6tables -A HARDEN6_BASE -p tcp --dport 443 -j ACCEPT
  ip6tables -A HARDEN6_BASE -j DROP

  while ip6tables -C INPUT -j HARDEN6_BASE 2>/dev/null; do
    ip6tables -D INPUT -j HARDEN6_BASE
  done
  ip6tables -I INPUT 1 -j HARDEN6_BASE
}

ensure_ipv4
ensure_ipv6
