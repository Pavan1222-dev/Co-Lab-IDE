import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../firebase';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import './Join.css'; // Assuming you have a CSS file for styling

const Join = () => {
  const [projectId, setProjectId] = useState('');
  const [message, setMessage] = useState('');
  const [requestStatus, setRequestStatus] = useState(null);
  const navigate = useNavigate();
  const user = auth.currentUser;

  // Listen for changes in the request status
  useEffect(() => {
    if (user && projectId) {
      const q = query(
        collection(db, 'projects', projectId, 'waitlist'),
        where('userId', '==', user.uid)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const status = snapshot.docs[0].data().status;
          setRequestStatus(status);
          if (status === 'rejected') {
             toast.error('Your request to join was declined by the host.');
          }
        } else {
          setRequestStatus(null);
        }
      });
      return () => unsubscribe();
    }
  }, [user, projectId]);

  // Automatically redirect when approved
  useEffect(() => {
    if (requestStatus === 'approved') {
      toast.success('Your request has been approved! Joining project...');
      navigate(`/project/${projectId}`);
    }
  }, [requestStatus, projectId, navigate]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!projectId) {
      toast.error('Please enter a Project ID.');
      return;
    }

    try {
      const projectRef = doc(db, 'projects', projectId);
      const projectSnap = await getDoc(projectRef);

      if (!projectSnap.exists()) {
        toast.error('Project not found.');
        return;
      }

      const projectData = projectSnap.data();

      // 1. Host Auto-Join: If you are the host, enter immediately.
      if (projectData.hostId === user.uid) {
        toast.success('Welcome back, Host! Entering project...');
        navigate(`/project/${projectId}`);
        return;
      }

      // Check if already a member
      if (projectData.members && projectData.members.includes(user.uid)) {
         toast.success('You are already a member. Entering project...');
         navigate(`/project/${projectId}`);
         return;
      }

      // 2. Send Join Request with Message
      const waitlistRef = doc(db, 'projects', projectId, 'waitlist', user.uid);
      await setDoc(waitlistRef, {
        userId: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        message: message.trim(),
        status: 'pending',
        timestamp: new Date()
      });

      toast.success('Join request sent! Please wait for the host to approve.');
      setMessage('');
    } catch (error) {
      console.error('Error sending join request:', error);
      toast.error('Failed to send join request.');
    }
  };

  return (
    <div className="join-container">
      <h2>Join a Project</h2>
      <form onSubmit={handleJoin}>
        <div className="input-group">
          <input
            type="text"
            placeholder="Enter Project ID"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={requestStatus === 'pending'}
            className="join-input"
          />
        </div>
        
        {/* 3. Message Input Area */}
        {requestStatus !== 'pending' && requestStatus !== 'rejected' && (
          <div className="input-group">
            <textarea
              placeholder="Optional: Add a message for the host (e.g., 'I'm here to help with the backend')"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="join-textarea"
              rows={3}
            />
          </div>
        )}

        <button type="submit" className="join-button" disabled={requestStatus === 'pending'}>
          {requestStatus === 'pending' ? (
            <>
              <i className="fas fa-spinner fa-spin"></i> Request Pending...
            </>
          ) : (
            'Send Join Request'
          )}
        </button>
      </form>

      {requestStatus === 'pending' && (
        <p className="status-message pending">
          Your request is pending. You can do other things while you wait. We'll take you to the project automatically once approved.
        </p>
      )}
      {requestStatus === 'rejected' && (
        <p className="status-message rejected">
          Your request to join this project was declined. Please check the ID or contact the host.
        </p>
      )}
    </div>
  );
};

export default Join;