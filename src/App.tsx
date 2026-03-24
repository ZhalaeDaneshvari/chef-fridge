import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginWithGoogle, logout } from './firebase';
import { Toaster } from 'sonner';
import { Fridge } from './components/Fridge';
import { Recipes } from './components/Recipes';
import { Profile } from './components/Profile';
import { Layout } from './components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { ChefHat, Refrigerator, User as UserIcon, LogOut, LogIn } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-stone-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <ChefHat className="w-12 h-12 text-stone-400" />
        </motion.div>
      </div>
    );
  }

  return (
    <Router>
      <Toaster position="top-center" richColors />
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-screen w-screen flex flex-col items-center justify-center bg-stone-50 p-6"
          >
            <div className="max-w-md w-full text-center space-y-8">
              <div className="space-y-2">
                <ChefHat className="w-16 h-16 mx-auto text-stone-800" />
                <h1 className="text-4xl font-serif font-light tracking-tight text-stone-900">ChefFridge AI</h1>
                <p className="text-stone-500 font-light italic">Your personal AI chef & fridge companion</p>
              </div>
              <button
                onClick={loginWithGoogle}
                className="w-full py-4 px-6 bg-stone-900 text-stone-50 rounded-full font-medium flex items-center justify-center gap-3 hover:bg-stone-800 transition-colors"
              >
                <LogIn className="w-5 h-5" />
                Connect with Google
              </button>
            </div>
          </motion.div>
        ) : (
          <Layout user={user}>
            <Routes>
              <Route path="/" element={<Fridge user={user} />} />
              <Route path="/recipes" element={<Recipes user={user} />} />
              <Route path="/profile" element={<Profile user={user} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        )}
      </AnimatePresence>
    </Router>
  );
}
