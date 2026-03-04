import { db } from './firebase';
import { 
  collection, addDoc, query, where, getDocs, 
  serverTimestamp, updateDoc, doc, arrayUnion 
} from 'firebase/firestore';

export const generateWebRTCHash = () => {
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `colab-${randomStr}`;
};

// CREATE: Initializes a new node on the grid
export const createWorkspace = async (userId, workspaceName) => {
  const roomHash = generateWebRTCHash();
  const workspaceData = {
    name: workspaceName,
    hostId: userId,
    hash: roomHash,
    members: [userId],
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, 'workspaces'), workspaceData);
  return { id: docRef.id, ...workspaceData };
};

// JOIN: Validates a hash and adds user to the access list
export const joinWorkspaceByHash = async (userId, hash) => {
  // ESLint FIX: Removed unnecessary try/catch wrapper
  const q = query(collection(db, 'workspaces'), where("hash", "==", hash));
  const snapshot = await getDocs(q);

  if (snapshot.empty) throw new Error("Node Hash not found on the grid.");

  const workspaceDoc = snapshot.docs[0];
  const workspaceRef = doc(db, 'workspaces', workspaceDoc.id);

  // Atomic update to add member without duplicates
  await updateDoc(workspaceRef, {
    members: arrayUnion(userId)
  });

  return { id: workspaceDoc.id, ...workspaceDoc.data() };
};

// FETCH: Gets all nodes where the user is a member
export const getUserWorkspaces = async (uid) => {
  if (!uid) return [];

  try {
    const projectsRef = collection(db, 'projects');

    // Query 1: Fetch all nodes where YOU are the Host
    const hostQuery = query(projectsRef, where('hostId', '==', uid));
    
    // Query 2: Fetch all nodes where YOU are an approved Guest
    const memberQuery = query(projectsRef, where('members', 'array-contains', uid));

    // Execute both database calls simultaneously for maximum speed
    const [hostSnap, memberSnap] = await Promise.all([
      getDocs(hostQuery),
      getDocs(memberQuery)
    ]);

    // Use a Map to prevent duplicates (in case a host is accidentally added to members)
    const workspacesMap = new Map();

    hostSnap.forEach(doc => {
      workspacesMap.set(doc.id, { id: doc.id, hash: doc.id, ...doc.data() });
    });

    memberSnap.forEach(doc => {
      workspacesMap.set(doc.id, { id: doc.id, hash: doc.id, ...doc.data() });
    });

    // Convert the Map to an array and sort it so the newest nodes appear first
    return Array.from(workspacesMap.values()).sort((a, b) => b.createdAt - a.createdAt);
    
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    return []; // Return empty array so the UI doesn't crash on failure
  }
};