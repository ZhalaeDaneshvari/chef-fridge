import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { getNutritionInfo, NutritionInfo } from '../services/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Loader2, Refrigerator, Info, Calendar, Flame, Beef, Wheat, Droplets } from 'lucide-react';
import { toast } from 'sonner';

interface FridgeItem {
  id: string;
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  addedAt: any;
}

export function Fridge({ user }: { user: User }) {
  const [items, setItems] = useState<FridgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', quantity: '' });
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const commonIngredients = [
    'Greek Yogurt', 'Green Beans', 'Green Peas', 'Grapes', 'Ground Beef', 'Ground Turkey',
    'Chicken Breast', 'Chicken Thighs', 'Cheddar Cheese', 'Carrots', 'Cucumber', 'Celery',
    'Eggs', 'Egg Whites', 'English Muffin', 'Eggplant',
    'Milk', 'Mozzarella', 'Mushrooms', 'Maple Syrup',
    'Onion', 'Olive Oil', 'Oatmeal', 'Orange Juice',
    'Potatoes', 'Pasta', 'Peanut Butter', 'Parmesan',
    'Rice', 'Red Onion', 'Raspberries', 'Romaine Lettuce',
    'Spinach', 'Strawberries', 'Salmon', 'Steak',
    'Tomatoes', 'Tuna', 'Tofu', 'Tortillas',
    'Zucchini'
  ];

  useEffect(() => {
    if (newItem.name.length > 1) {
      const filtered = commonIngredients.filter(ing => 
        ing.toLowerCase().startsWith(newItem.name.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [newItem.name]);

  useEffect(() => {
    const q = query(
      collection(db, 'users', user.uid, 'fridgeItems'),
      orderBy('addedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FridgeItem[];
      setItems(itemsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching fridge items:", error);
      toast.error("Failed to load fridge items");
    });

    return unsubscribe;
  }, [user.uid]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name || !newItem.quantity) return;

    setAdding(true);
    try {
      const nutrition = await getNutritionInfo(newItem.name, newItem.quantity);
      
      await addDoc(collection(db, 'users', user.uid, 'fridgeItems'), {
        ...newItem,
        ...nutrition,
        addedAt: serverTimestamp()
      });

      setNewItem({ name: '', quantity: '' });
      toast.success(`${newItem.name} added to your fridge!`);
    } catch (error) {
      console.error("Error adding item:", error);
      toast.error("Failed to add item. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'fridgeItems', id));
      toast.success("Item removed");
    } catch (error) {
      toast.error("Failed to remove item");
    }
  };

  return (
    <div className="space-y-12">
      <header className="space-y-2">
        <h2 className="text-4xl font-serif font-light tracking-tight">Your Fridge</h2>
        <p className="text-stone-500 font-light italic">Track what's inside and stay organized</p>
      </header>

      {/* Add Item Form */}
      <section className="bg-white p-8 rounded-[32px] shadow-sm border border-stone-100">
        <form onSubmit={handleAddItem} className="flex flex-col md:flex-row gap-4 relative">
          <div className="flex-1 space-y-1 relative">
            <label className="text-[10px] uppercase tracking-widest font-semibold text-stone-400 ml-4">Item Name</label>
            <input
              type="text"
              placeholder="e.g. Greek Yogurt, Chicken Breast"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-stone-200 transition-all"
            />
            <AnimatePresence>
              {suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute z-10 w-full mt-2 bg-white border border-stone-100 rounded-2xl shadow-xl overflow-hidden"
                >
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setNewItem({ ...newItem, name: suggestion });
                        setSuggestions([]);
                      }}
                      className="w-full text-left px-6 py-3 hover:bg-stone-50 text-stone-600 text-sm transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="w-full md:w-48 space-y-1">
            <label className="text-[10px] uppercase tracking-widest font-semibold text-stone-400 ml-4">Quantity</label>
            <input
              type="text"
              placeholder="e.g. 500g, 2 packs"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
              className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-stone-200 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !newItem.name || !newItem.quantity}
            className="md:self-end h-[60px] px-8 bg-stone-900 text-stone-50 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-stone-800 disabled:opacity-50 transition-all shadow-lg shadow-stone-200"
          >
            {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            Add Item
          </button>
        </form>
      </section>

      {/* Items Grid */}
      <section>
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-stone-300 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 bg-stone-100/50 rounded-[32px] border border-dashed border-stone-200">
            <Refrigerator className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-400 font-light italic">Your fridge is empty. Add some items to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group bg-white p-6 rounded-[32px] border border-stone-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-serif font-light text-stone-900">{item.name}</h3>
                      <p className="text-sm text-stone-400 font-light italic">{item.quantity}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-6">
                    <div className="bg-stone-50 p-3 rounded-2xl text-center">
                      <Flame className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                      <p className="text-[10px] font-bold text-stone-900">{item.calories}</p>
                      <p className="text-[8px] uppercase tracking-tighter text-stone-400">kcal</p>
                    </div>
                    <div className="bg-stone-50 p-3 rounded-2xl text-center">
                      <Beef className="w-4 h-4 text-red-400 mx-auto mb-1" />
                      <p className="text-[10px] font-bold text-stone-900">{item.protein}g</p>
                      <p className="text-[8px] uppercase tracking-tighter text-stone-400">prot</p>
                    </div>
                    <div className="bg-stone-50 p-3 rounded-2xl text-center">
                      <Wheat className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                      <p className="text-[10px] font-bold text-stone-900">{item.carbs}g</p>
                      <p className="text-[8px] uppercase tracking-tighter text-stone-400">carb</p>
                    </div>
                    <div className="bg-stone-50 p-3 rounded-2xl text-center">
                      <Droplets className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                      <p className="text-[10px] font-bold text-stone-900">{item.fat}g</p>
                      <p className="text-[8px] uppercase tracking-tighter text-stone-400">fat</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-stone-400 uppercase tracking-widest font-semibold">
                    <Calendar className="w-3 h-3" />
                    Added {item.addedAt?.toDate().toLocaleDateString()}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}
