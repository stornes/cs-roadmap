import React, { useState, useEffect } from 'react';
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebaseConfig';
import { Shield, Lock, Compass, Info } from 'lucide-react';

interface GoogleSignInProps {
  onSignInSuccess: (user: any, role: string) => void;
}

export const GoogleSignIn: React.FC<GoogleSignInProps> = ({ onSignInSuccess }) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 1. Redirect Result Handler
  useEffect(() => {
    setLoading(true);
    
    // Safety timeout to clear loading state if getRedirectResult hangs (common in Safari/private tabs)
    const timeoutId = setTimeout(() => {
      console.warn("getRedirectResult timed out after 3 seconds, releasing UI lock.");
      setLoading(false);
    }, 3000);

    getRedirectResult(auth)
      .then(async (result) => {
        clearTimeout(timeoutId);
        if (result) {
          await processUserSignIn(result.user);
        }
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        console.error("Redirect sign-in error:", err);
        if (err.code === 'auth/operation-not-allowed') {
          setError('Google Sign-in is disabled. In the Firebase Console, go to Authentication > Sign-in method, click "Add new provider", select Google, toggle Enable, set a support email, and save.');
        } else {
          setError(err.message || "An error occurred returning from Google Sign-in.");
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const processUserSignIn = async (user: any) => {
    const email = user.email || '';
    const isAllowedDomain = email.endsWith('@hurtigruten.com');
    const isOwner = email === 'stornes@gmail.com';

    if (!isAllowedDomain && !isOwner) {
      await signOut(auth);
      setError('Access Denied. Only @hurtigruten.com accounts are authorized.');
      return;
    }

    // Check if user exists in Firestore
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);

    let finalRole = 'viewer';
    if (isOwner) {
      finalRole = 'admin'; // Owner is Admin by default
    }

    if (!userDocSnap.exists()) {
      // Create new user profile
      const newUser = {
        email,
        name: user.displayName || 'Anonymous',
        avatarUrl: user.photoURL || '',
        role: finalRole,
        status: 'active',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      };
      await setDoc(userDocRef, newUser);
    } else {
      // Update last login and get existing role
      const existingData = userDocSnap.data();
      finalRole = existingData.role || 'viewer';
      await updateDoc(userDocRef, {
        lastLogin: serverTimestamp(),
        name: user.displayName || existingData.name,
        avatarUrl: user.photoURL || existingData.avatarUrl
      });
      
      if (existingData.status === 'pending' || existingData.status === 'disabled') {
        await signOut(auth);
        setError(`Your account status is currently ${existingData.status}. Please contact an Admin.`);
        return;
      }
    }

    onSignInSuccess(user, finalRole);
  };

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await processUserSignIn(result.user);
    } catch (err: any) {
      console.warn("Popup sign-in failed or blocked, attempting redirect fallback...", err);
      // Fallback for popup blockers or user-closed popups
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectErr: any) {
          console.error(redirectErr);
          setError(redirectErr.message || 'Failed to redirect to Google Sign-in.');
          setLoading(false);
        }
      } else {
        console.error(err);
        if (err.code === 'auth/operation-not-allowed') {
          setError('Google Sign-in is disabled. In the Firebase Console, go to Authentication > Sign-in method, click "Add new provider", select Google, toggle Enable, set a support email, and save.');
        } else {
          setError(err.message || 'An error occurred during sign-in.');
        }
        setLoading(false);
      }
    }
  };

  const handleMockSignIn = () => {
    // Generate a mock user profile representing the owner
    const mockUser = {
      uid: 'mock-admin-stornes',
      email: 'stornes@gmail.com',
      displayName: 'Sverre Stornes (Local Admin)',
      photoURL: ''
    };
    onSignInSuccess(mockUser, 'admin');
  };

  return (
    <div className="relative min-screen w-full flex items-center justify-center bg-[#070913] overflow-hidden" style={{ minHeight: '100vh' }}>
      {/* Decorative Aurora Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-brand-purple/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-brand-teal/10 blur-[120px] pointer-events-none" />

      <div className="glass w-full max-w-md p-8 rounded-2xl shadow-2xl flex flex-col items-center z-10 mx-4">
        <div className="w-16 h-16 rounded-2xl bg-brand-purple/20 border border-brand-purple/30 flex items-center justify-center mb-6">
          <Compass className="w-8 h-8 text-brand-purple animate-pulse" />
        </div>

        <h1 className="text-3xl font-display font-bold tracking-tight text-white mb-2 text-center">
          Hurtigruten
        </h1>
        <p className="text-sm font-sans text-gray-400 mb-8 text-center">
          Customer Systems Roadmap Planner
        </p>

        {/* Info Callout */}
        <div className="w-full p-4 mb-6 bg-brand-purple/10 border border-brand-purple/20 text-gray-300 text-xs rounded-xl flex items-start space-x-3">
          <Info className="w-4 h-4 text-brand-purple shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white block mb-0.5">Google Sign-in Unconfigured</span>
            <span>Google Auth is not enabled in your Firebase console. Click the primary button below to bypass and log in instantly.</span>
          </div>
        </div>

        {error && (
          <div className="w-full p-4 mb-6 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-start space-x-3">
            <Shield className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1.5">
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Primary Bypass Button */}
        <button
          onClick={handleMockSignIn}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-brand-purple to-brand-blue hover:opacity-95 transition-all text-white font-medium rounded-xl flex items-center justify-center space-x-3 shadow-lg cursor-pointer"
        >
          <Compass className="w-5 h-5 text-white animate-pulse" />
          <span>Bypass with Local Admin Account (Dev)</span>
        </button>

        {/* Secondary Google Sign-in */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full mt-4 py-2.5 px-4 bg-gray-900 hover:bg-gray-800 border border-white/5 transition-all text-gray-400 hover:text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Lock className="w-4 h-4" />
          <span>{loading ? 'Authenticating...' : 'Sign in with Google (OAuth)'}</span>
        </button>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            Internal Confidential. Authorized Hurtigruten Domain Only.
          </p>
        </div>
      </div>
    </div>
  );
};
