import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDoc, orderBy, limit, Timestamp, getDocFromServer } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Utensils, Flame, Plus, Calendar, TrendingUp, ChevronRight, Loader2, Footprints, RefreshCcw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { auth } from '../firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Meal {
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

interface NutritionLog {
  id: string;
  date: string;
  caloriesConsumed: number;
  caloriesBurned: number;
  steps: number;
  meals: Meal[];
  protein: number;
  carbs: number;
  fat: number;
}

export function Fitness({ user }: { user: User }) {
  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [showManualSync, setShowManualSync] = useState(false);
  const [newMeal, setNewMeal] = useState<Meal>({ name: '', calories: 0 });
  const [manualData, setManualData] = useState({ steps: 0, caloriesBurned: 0 });
  const [targetCalories, setTargetCalories] = useState(2000);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    // Fetch target calories from profile
    const fetchProfile = async () => {
      const path = `users/${user.uid}`;
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTargetCalories(docSnap.data().targetCalories || 2000);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    };
    fetchProfile();

    const path = `users/${user.uid}/nutritionLog`;
    const q = query(
      collection(db, 'users', user.uid, 'nutritionLog'),
      orderBy('date', 'desc'),
      limit(7)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NutritionLog[];
      setLogs(logData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return unsubscribe;
  }, [user.uid]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayLog = logs.find(l => l.date === todayStr);

  const handleAddMeal = async () => {
    if (!newMeal.name || newMeal.calories <= 0) {
      toast.error("Please enter a valid meal name and calories.");
      return;
    }

    try {
      const logRef = collection(db, 'users', user.uid, 'nutritionLog');
      const path = todayLog ? `users/${user.uid}/nutritionLog/${todayLog.id}` : `users/${user.uid}/nutritionLog`;
      
      if (todayLog) {
        const docRef = doc(db, 'users', user.uid, 'nutritionLog', todayLog.id);
        await updateDoc(docRef, {
          caloriesConsumed: (todayLog.caloriesConsumed || 0) + newMeal.calories,
          meals: [...(todayLog.meals || []), newMeal],
          protein: (todayLog.protein || 0) + (newMeal.protein || 0),
          carbs: (todayLog.carbs || 0) + (newMeal.carbs || 0),
          fat: (todayLog.fat || 0) + (newMeal.fat || 0)
        });
      } else {
        await addDoc(logRef, {
          date: todayStr,
          caloriesConsumed: newMeal.calories,
          caloriesBurned: 0,
          steps: 0,
          meals: [newMeal],
          protein: newMeal.protein || 0,
          carbs: newMeal.carbs || 0,
          fat: newMeal.fat || 0,
          createdAt: Timestamp.now()
        });
      }

      toast.success("Meal logged!");
      setShowAddMeal(false);
      setNewMeal({ name: '', calories: 0 });
    } catch (err) {
      console.error(err);
      toast.error("Failed to log meal.");
      handleFirestoreError(err, todayLog ? OperationType.UPDATE : OperationType.CREATE, todayLog ? `users/${user.uid}/nutritionLog/${todayLog.id}` : `users/${user.uid}/nutritionLog`);
    }
  };

  const handleManualSync = async () => {
    const path = todayLog ? `users/${user.uid}/nutritionLog/${todayLog.id}` : `users/${user.uid}/nutritionLog`;
    try {
      if (todayLog) {
        const docRef = doc(db, 'users', user.uid, 'nutritionLog', todayLog.id);
        await updateDoc(docRef, {
          caloriesBurned: manualData.caloriesBurned,
          steps: manualData.steps
        });
      } else {
        await addDoc(collection(db, 'users', user.uid, 'nutritionLog'), {
          date: todayStr,
          caloriesConsumed: 0,
          caloriesBurned: manualData.caloriesBurned,
          steps: manualData.steps,
          meals: [],
          protein: 0,
          carbs: 0,
          fat: 0,
          createdAt: Timestamp.now()
        });
      }
      toast.success("Fitness data updated manually!");
      setShowManualSync(false);
    } catch (err) {
      toast.error("Failed to update fitness data");
      handleFirestoreError(err, todayLog ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };
  const syncHealthData = async () => {
    setSyncing(true);
    
    // Note: Direct Apple HealthKit access is not possible from a standard web browser 
    // due to privacy and security restrictions. It requires a native app wrapper.
    // We provide a clear message as requested by the user.
    
    try {
      // Check if we are in a context that might support health data (e.g. some specialized browsers or future APIs)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      // Simulate a check for HealthKit availability
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (isIOS && 'health' in navigator) {
        // Hypothetical future web API
        toast.success("Connected to HealthKit!");
      } else {
        // Clear message for unsupported platform
        toast.error("Health Sync Not Supported", {
          description: "Apple HealthKit syncing is restricted to native iOS applications. To track your fitness here, please enter your steps and calories manually.",
          duration: 6000,
        });
      }
    } catch (err) {
      toast.error("An error occurred while attempting to sync.");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-stone-300" />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <header className="space-y-2">
        <h2 className="text-4xl font-serif font-light tracking-tight text-stone-900">Fitness & Nutrition</h2>
        <p className="text-stone-500 font-light italic">Track your energy balance and daily intake</p>
      </header>

      {/* Daily Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-stone-50 text-stone-900 rounded-2xl">
              <Footprints className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Steps</span>
          </div>
          <div>
            <p className="text-3xl font-serif font-light">{todayLog?.steps || 0}</p>
            <p className="text-sm text-stone-400">steps today</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={syncHealthData}
              disabled={syncing}
              className="flex-1 py-2 text-xs font-medium text-orange-600 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors flex items-center justify-center gap-2"
            >
              {syncing ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
              Sync Health
            </button>
            <button 
              onClick={() => setShowManualSync(true)}
              className="px-3 py-2 text-xs font-medium text-stone-600 bg-stone-50 rounded-xl hover:bg-stone-100 transition-colors"
            >
              Manual
            </button>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
              <Flame className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Burned</span>
          </div>
          <div>
            <p className="text-3xl font-serif font-light">{todayLog?.caloriesBurned || 0}</p>
            <p className="text-sm text-stone-400">kcal today</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Utensils className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Consumed</span>
          </div>
          <div>
            <p className="text-3xl font-serif font-light">{todayLog?.caloriesConsumed || 0}</p>
            <p className="text-sm text-stone-400">kcal today</p>
          </div>
          <button 
            onClick={() => setShowAddMeal(true)}
            className="w-full py-2 text-xs font-medium text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
          >
            Log a Meal
          </button>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-stone-900 p-8 rounded-[32px] text-stone-50 shadow-xl space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-stone-800 text-stone-400 rounded-2xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Net Balance</span>
          </div>
          <div>
            <p className="text-3xl font-serif font-light">
              {(todayLog?.caloriesConsumed || 0) - (todayLog?.caloriesBurned || 0)}
            </p>
            <p className="text-sm text-stone-500">kcal net / {targetCalories} goal</p>
          </div>
          <div className="h-1 bg-stone-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-stone-50 transition-all duration-1000"
              style={{ width: `${Math.min(100, ((todayLog?.caloriesConsumed || 0) / targetCalories) * 100)}%` }}
            />
          </div>
        </motion.div>
      </div>

      {/* Recent Logs */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-serif font-light">Recent Activity</h3>
          <Calendar className="w-5 h-5 text-stone-400" />
        </div>
        <div className="space-y-4">
          {logs.map((log, idx) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white p-6 rounded-3xl border border-stone-100 flex items-center justify-between hover:border-stone-200 transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center text-stone-400 group-hover:bg-stone-900 group-hover:text-stone-50 transition-colors">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-stone-900">{format(new Date(log.date), 'EEEE, MMM do')}</p>
                  <p className="text-sm text-stone-400">{log.meals.length} meals logged</p>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-sm font-medium text-stone-900">+{log.caloriesConsumed} kcal</p>
                  <p className="text-xs text-stone-400">Consumed</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-orange-600">-{log.caloriesBurned} kcal</p>
                  <p className="text-xs text-stone-400">Burned</p>
                </div>
                <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-stone-900 transition-colors" />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Manual Sync Modal */}
      <AnimatePresence>
        {showManualSync && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[40px] p-10 space-y-8 shadow-2xl"
            >
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-serif font-light text-stone-900">Manual Fitness Entry</h3>
                <p className="text-stone-500 text-sm font-light italic">Enter your activity data manually</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-400 uppercase tracking-wider ml-4">Steps Today</label>
                  <input
                    type="number"
                    value={manualData.steps || ''}
                    onChange={(e) => setManualData({ ...manualData, steps: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full px-6 py-4 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-stone-900 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-400 uppercase tracking-wider ml-4">Calories Burned (kcal)</label>
                  <input
                    type="number"
                    value={manualData.caloriesBurned || ''}
                    onChange={(e) => setManualData({ ...manualData, caloriesBurned: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full px-6 py-4 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-stone-900 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowManualSync(false)}
                  className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-medium hover:bg-stone-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleManualSync}
                  className="flex-1 py-4 bg-stone-900 text-stone-50 rounded-2xl font-medium hover:bg-stone-800 transition-all"
                >
                  Save Data
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAddMeal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[40px] p-10 space-y-8 shadow-2xl"
            >
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-serif font-light">Log a Meal</h3>
                <p className="text-stone-500 text-sm font-light italic">What did you eat today?</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-400 uppercase tracking-wider ml-4">Meal Name</label>
                  <input
                    type="text"
                    value={newMeal.name}
                    onChange={(e) => setNewMeal({ ...newMeal, name: e.target.value })}
                    placeholder="e.g. Avocado Toast"
                    className="w-full px-6 py-4 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-stone-900 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-400 uppercase tracking-wider ml-4">Calories (kcal)</label>
                  <input
                    type="number"
                    value={newMeal.calories || ''}
                    onChange={(e) => setNewMeal({ ...newMeal, calories: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full px-6 py-4 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-stone-900 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowAddMeal(false)}
                  className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-medium hover:bg-stone-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMeal}
                  className="flex-1 py-4 bg-stone-900 text-stone-50 rounded-2xl font-medium hover:bg-stone-800 transition-all"
                >
                  Log Meal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
