import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, getDocFromServer, doc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Loader2, History, ShoppingBag, Flame, Beef, Wheat, Droplets, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useHousehold } from '../contexts/HouseholdContext';
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

interface HistoryItem {
  id: string;
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  addedAt: any;
}

export function HistoryLog({ user }: { user: User }) {
  const { household } = useHousehold();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const basePath = household ? `households/${household.id}` : `users/${user.uid}`;

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

    const path = `${basePath}/history`;
    const q = query(
      collection(db, basePath, 'history'),
      orderBy('addedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HistoryItem[];
      setItems(itemsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return unsubscribe;
  }, [basePath]);

  const handleAddToFridge = async (item: HistoryItem) => {
    try {
      const { id, ...itemData } = item;
      await addDoc(collection(db, basePath, 'fridgeItems'), {
        ...itemData,
        addedAt: serverTimestamp(),
        removedAt: null
      });
      toast.success(`${item.name} added back to fridge!`);
    } catch (error) {
      toast.error("Failed to add item to fridge");
      handleFirestoreError(error, OperationType.CREATE, `${basePath}/fridgeItems`);
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-12">
      <header className="space-y-2">
        <h2 className="text-4xl font-serif font-light tracking-tight">History Log</h2>
        <p className="text-stone-500 font-light italic">Every item you've ever bought, all in one place</p>
      </header>

      <section className="relative">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
        <input
          type="text"
          placeholder="Search your history..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-16 pr-6 py-5 bg-white rounded-[32px] border border-stone-100 shadow-sm focus:ring-2 focus:ring-stone-200 transition-all"
        />
      </section>

      <section>
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-stone-300 animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 bg-stone-100/50 rounded-[32px] border border-dashed border-stone-200">
            <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-400 font-light italic">No history found. Start adding items to your fridge!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white p-6 rounded-[32px] border border-stone-100 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-serif font-light text-stone-900">{item.name}</h3>
                      <p className="text-xs text-stone-400 font-light italic">{item.quantity}</p>
                    </div>
                    <button
                      onClick={() => handleAddToFridge(item)}
                      className="p-3 bg-stone-50 text-stone-400 hover:bg-stone-900 hover:text-stone-50 rounded-2xl transition-all"
                      title="Add to Fridge"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="bg-stone-50 p-2 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-stone-900">{item.calories}</p>
                      <p className="text-[8px] uppercase tracking-tighter text-stone-400">kcal</p>
                    </div>
                    <div className="bg-stone-50 p-2 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-stone-900">{item.protein}g</p>
                      <p className="text-[8px] uppercase tracking-tighter text-stone-400">prot</p>
                    </div>
                    <div className="bg-stone-50 p-2 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-stone-900">{item.carbs}g</p>
                      <p className="text-[8px] uppercase tracking-tighter text-stone-400">carb</p>
                    </div>
                    <div className="bg-stone-50 p-2 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-stone-900">{item.fat}g</p>
                      <p className="text-[8px] uppercase tracking-tighter text-stone-400">fat</p>
                    </div>
                  </div>

                  <p className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold">
                    Bought {item.addedAt?.toDate().toLocaleDateString()}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}
