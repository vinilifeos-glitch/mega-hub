#!/usr/bin/env node
/** Generate VAPID keys for Web Push. Print public key for EXPO_PUBLIC_VAPID_PUBLIC_KEY; keep private for edge secrets. */
import webpush from 'web-push';
const keys = webpush.generateVAPIDKeys();
console.log('EXPO_PUBLIC_VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('# Set VAPID_SUBJECT=mailto:you@example.com on the edge function too.');
