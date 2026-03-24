import React, { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { readTextFile, writeTextFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { dirname, join } from '@tauri-apps/api/path';
import { auth } from '../../services/firebase';
import toast from 'react-hot-toast';
import { getProviderOptions } from '../../services/webrtcConfig';

const isTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;

export default function GhostSyncEngine({ roomHash, isHost, projectRoot, activeFile }) {
  const yProvider = useRef(null);
  const yFileChannel = useRef(null);
  
  const [localPeerId] = useState(() => auth.currentUser?.uid || Math.random().toString(36).substring(7));

  useEffect(() => {
    if (!roomHash) return;

    const transferRoomName = `${roomHash}-ghost-transfer`;
    const ydoc = new Y.Doc();
    
    yProvider.current = new WebrtcProvider(transferRoomName, ydoc, getProviderOptions());
    yFileChannel.current = ydoc.getArray('file_events');

    yFileChannel.current.observe(async (event) => {
      if (event.transaction.local) return;

      const changes = event.changes.delta;
      for (const delta of changes) {
        if (!delta.insert) continue;

        for (const payloadStr of delta.insert) {
          try {
            const payload = JSON.parse(payloadStr);

            // 🔴 HOST RECEIVES REQUEST: Reads using relative path securely
            if (isHost && payload.type === 'REQUEST_FILE') {
              if (!projectRoot) return;
              try {
                const fullHostPath = await join(projectRoot, payload.relativePath);
                const fileContent = await readTextFile(fullHostPath);
                
                const responsePayload = JSON.stringify({
                  type: 'RECEIVE_FILE',
                  targetGuestId: payload.requesterId,
                  relativePath: payload.relativePath,
                  content: fileContent
                });
                yFileChannel.current.push([responsePayload]);
              } catch (err) {
                console.error("[HOST ENGINE] Failed to read file for guest:", err);
              }
            }

            // 🔴 GUEST RECEIVES FILE: Writes using local absolute path securely
            if (!isHost && payload.type === 'RECEIVE_FILE' && payload.targetGuestId === localPeerId) {
              if (!projectRoot) return; 
              try {
                const fullGuestPath = await join(projectRoot, payload.relativePath);
                
                const dir = await dirname(fullGuestPath);
                const dirExists = await exists(dir);
                if (!dirExists) await mkdir(dir, { recursive: true });

                await writeTextFile(fullGuestPath, payload.content);
                toast.success(`Synced: ${payload.relativePath}`, { icon: '⚡' });
              } catch (err) {
                console.error("[GUEST ENGINE] Failed to write incoming file:", err);
              }
            }

          } catch (e) {
            console.debug("Failed to parse file event", e);
          }
        }
      }
    });

    return () => {
      if (yProvider.current) {
        yProvider.current.disconnect();
        yProvider.current.destroy();
      }
      ydoc.destroy();
    };
  }, [roomHash, isHost, projectRoot, localPeerId]);

  useEffect(() => {
    const checkAndRequestFile = async () => {
      // 🔴 If no relativePath exists yet (e.g. Welcome.js default), skip requesting
      if (isHost || !activeFile.relativePath || !projectRoot || !isTauri) return;
      try {
        const fullGuestPath = await join(projectRoot, activeFile.relativePath);
        const fileExists = await exists(fullGuestPath);
        
        if (!fileExists) {
          toast.loading(`Requesting file from Host...`, { duration: 2000 });
          const requestPayload = JSON.stringify({
            type: 'REQUEST_FILE',
            requesterId: localPeerId,
            relativePath: activeFile.relativePath 
          });
          if (yFileChannel.current) yFileChannel.current.push([requestPayload]);
        }
      } catch (error) {
        console.error("Error checking file existence", error);
      }
    };
    checkAndRequestFile();
  }, [activeFile.relativePath, isHost, projectRoot, localPeerId]);

  return null; 
}