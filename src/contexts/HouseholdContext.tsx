import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { toast } from 'sonner';

interface Household {
  id: string;
  name: string;
  members: string[];
  createdBy: string;
  createdAt: string;
}

interface HouseholdContextType {
  household: Household | null;
  loading: boolean;
  createHousehold: (name: string) => Promise<void>;
  joinHousehold: (id: string) => Promise<void>;
  leaveHousehold: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export function HouseholdProvider({ children, user }: { children: React.ReactNode, user: User | null }) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHousehold(null);
      setLoading(false);
      return;
    }

    const fetchUserHousehold = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      
      if (userData?.householdId) {
        const unsubscribe = onSnapshot(doc(db, 'households', userData.householdId), (docSnap) => {
          if (docSnap.exists()) {
            setHousehold({ id: docSnap.id, ...docSnap.data() } as Household);
          } else {
            setHousehold(null);
          }
          setLoading(false);
        });
        return unsubscribe;
      } else {
        setHousehold(null);
        setLoading(false);
      }
    };

    fetchUserHousehold();
  }, [user]);

  const createHousehold = async (name: string) => {
    if (!user) return;
    const householdId = Math.random().toString(36).substring(2, 10).toUpperCase();
    const newHousehold = {
      name,
      members: [user.uid],
      createdBy: user.uid,
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'households', householdId), newHousehold);
    await updateDoc(doc(db, 'users', user.uid), { householdId });
    toast.success(`Household "${name}" created!`);
  };

  const joinHousehold = async (id: string) => {
    if (!user) return;
    const householdDoc = await getDoc(doc(db, 'households', id));
    if (!householdDoc.exists()) {
      toast.error("Household not found.");
      return;
    }

    await updateDoc(doc(db, 'households', id), {
      members: arrayUnion(user.uid)
    });
    await updateDoc(doc(db, 'users', user.uid), { householdId: id });
    toast.success("Joined household!");
  };

  const leaveHousehold = async () => {
    if (!user || !household) return;
    // Simple implementation: just remove from user profile
    await updateDoc(doc(db, 'users', user.uid), { householdId: null });
    toast.success("Left household.");
  };

  return (
    <HouseholdContext.Provider value={{ household, loading, createHousehold, joinHousehold, leaveHousehold }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export const useHousehold = () => {
  const context = useContext(HouseholdContext);
  if (context === undefined) {
    throw new Error('useHousehold must be used within a HouseholdProvider');
  }
  return context;
};
