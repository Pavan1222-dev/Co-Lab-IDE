// This file centralizes our P2P network traversal strategy.
// It uses Metered's Open Relay Project (Port 80/443) to guarantee 
// connections punch through strict Enterprise/University firewalls.

export const SIGNALING_SERVERS = ['wss://colab-matchmaker-v2.onrender.com'];

export const getIceServers = () => [
  // 1. Primary Google STUN (Fastest for home networks)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  
  // 2. Metered Open Relay STUN Backup
  { urls: 'stun:openrelay.metered.ca:80' },
  
  // 3. The TURN Relays (The Enterprise Firewall Bypassers)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  }
];

// Reusable provider options to inject into all y-webrtc instances
export const getProviderOptions = () => ({
  signaling: SIGNALING_SERVERS,
  peerOpts: {
    config: {
      iceServers: getIceServers(),
      // 'all' allows ICE to try local, STUN, and TURN simultaneously 
      iceTransportPolicy: 'all' 
    }
  }
});