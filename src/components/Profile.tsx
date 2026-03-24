import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { User as UserIcon, Heart, Ban, ShieldAlert, Plus, X, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface UserProfile {
  preferences: {
    likes: string[];
    dislikes: string[];
    dietaryRestrictions: string[];
  };
}

export function Profile({ user }: { user: User }) {
  const [profile, setProfile] = useState<UserProfile>({
    preferences: { likes: [], dislikes: [], dietaryRestrictions: [] }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newInputs, setNewInputs] = useState({ like: '', dislike: '', restriction: '' });

  useEffect(() => {
    const fetchProfile = async () => {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        // Initialize profile
        const initialProfile = {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          preferences: { likes: [], dislikes: [], dietaryRestrictions: [] }
        };
        await setDoc(docRef, initialProfile);
        setProfile(initialProfile as UserProfile);
      }
      setLoading(false);
    };
    fetchProfile();
  }, [user.uid]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        preferences: profile.preferences
      });
      toast.success("Preferences updated!");
    } catch (error) {
      toast.error("Failed to update preferences");
    } finally {
      setSaving(false);
    }
  };

  const addItem = (type: 'likes' | 'dislikes' | 'dietaryRestrictions', value: string) => {
    if (!value) return;
    setProfile({
      ...profile,
      preferences: {
        ...profile.preferences,
        [type]: [...profile.preferences[type], value]
      }
    });
    setNewInputs({ ...newInputs, [type === 'likes' ? 'like' : type === 'dislikes' ? 'dislike' : 'restriction']: '' });
  };

  const removeItem = (type: 'likes' | 'dislikes' | 'dietaryRestrictions', index: number) => {
    const newList = [...profile.preferences[type]];
    newList.splice(index, 1);
    setProfile({
      ...profile,
      preferences: {
        ...profile.preferences,
        [type]: newList
      }
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-stone-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-serif font-light tracking-tight">Your Profile</h2>
          <p className="text-stone-500 font-light italic">Customize your AI chef's knowledge of you</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-[60px] px-8 bg-stone-900 text-stone-50 rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-stone-800 disabled:opacity-50 transition-all shadow-lg shadow-stone-200"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Save Changes
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Likes */}
        <PreferenceSection
          title="Likes"
          icon={Heart}
          color="text-red-400"
          items={profile.preferences.likes}
          onAdd={(val) => addItem('likes', val)}
          onRemove={(idx) => removeItem('likes', idx)}
          inputValue={newInputs.like}
          onInputChange={(val) => setNewInputs({ ...newInputs, like: val })}
          placeholder="e.g. Spicy food, Salmon"
        />

        {/* Dislikes */}
        <PreferenceSection
          title="Dislikes"
          icon={Ban}
          color="text-stone-400"
          items={profile.preferences.dislikes}
          onAdd={(val) => addItem('dislikes', val)}
          onRemove={(idx) => removeItem('dislikes', idx)}
          inputValue={newInputs.dislike}
          onInputChange={(val) => setNewInputs({ ...newInputs, dislike: val })}
          placeholder="e.g. Cilantro, Olives"
        />

        {/* Dietary Restrictions */}
        <PreferenceSection
          title="Dietary Restrictions"
          icon={ShieldAlert}
          color="text-amber-400"
          items={profile.preferences.dietaryRestrictions}
          onAdd={(val) => addItem('dietaryRestrictions', val)}
          onRemove={(idx) => removeItem('dietaryRestrictions', idx)}
          inputValue={newInputs.restriction}
          onInputChange={(val) => setNewInputs({ ...newInputs, restriction: val })}
          placeholder="e.g. Vegan, Gluten-free"
        />
      </div>
    </div>
  );
}

function PreferenceSection({ title, icon: Icon, color, items, onAdd, onRemove, inputValue, onInputChange, placeholder }: any) {
  return (
    <section className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm space-y-6">
      <div className="flex items-center gap-3">
        <Icon className={cn("w-6 h-6", color)} />
        <h3 className="text-xl font-serif font-light text-stone-900">{title}</h3>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd(inputValue)}
          className="flex-1 px-4 py-3 bg-stone-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-stone-200 transition-all"
        />
        <button
          onClick={() => onAdd(inputValue)}
          className="p-3 bg-stone-900 text-stone-50 rounded-xl hover:bg-stone-800 transition-all"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <AnimatePresence>
          {items.map((item: string, idx: number) => (
            <motion.span
              key={idx}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="px-3 py-1.5 bg-stone-50 text-stone-600 text-xs font-medium rounded-lg flex items-center gap-2 group"
            >
              {item}
              <button
                onClick={() => onRemove(idx)}
                className="text-stone-300 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
