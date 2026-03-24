import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, Refrigerator, Info } from 'lucide-react';
import { format, addDays, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { toast } from 'sonner';
import { useHousehold } from '../contexts/HouseholdContext';

interface FridgeItem {
  id: string;
  name: string;
  quantity: string;
  addedAt: any;
  removedAt?: any;
}

export function CalendarView({ user }: { user: User }) {
  const { household } = useHousehold();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [items, setItems] = useState<FridgeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const basePath = household ? `households/${household.id}` : `users/${user.uid}`;

  useEffect(() => {
    // Fetch all fridge items for this user (both current and past)
    const q = query(collection(db, basePath, 'fridgeItems'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FridgeItem[];
      setItems(itemsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching items for calendar:", error);
      toast.error("Failed to load calendar data");
    });

    return unsubscribe;
  }, [basePath]);

  const itemsOnSelectedDate = items.filter(item => {
    const addedAt = item.addedAt?.toDate();
    const removedAt = item.removedAt?.toDate();
    
    if (!addedAt) return false;

    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);

    // Item was in fridge if it was added before or on the selected date
    // AND (it hasn't been removed OR it was removed after the selected date)
    const wasAddedBeforeOrOn = addedAt <= end;
    const wasNotRemovedOrRemovedAfter = !removedAt || removedAt >= start;

    return wasAddedBeforeOrOn && wasNotRemovedOrRemovedAfter;
  });

  return (
    <div className="space-y-12">
      <header className="space-y-2">
        <h2 className="text-4xl font-serif font-light tracking-tight">Fridge Calendar</h2>
        <p className="text-stone-500 font-light italic">See what was in your fridge on any given day</p>
      </header>

      {/* Date Selector */}
      <section className="bg-white p-8 rounded-[32px] shadow-sm border border-stone-100 flex items-center justify-between">
        <button
          onClick={() => setSelectedDate(subDays(selectedDate, 1))}
          className="p-4 hover:bg-stone-50 rounded-2xl transition-all"
        >
          <ChevronLeft className="w-6 h-6 text-stone-400" />
        </button>
        
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-1">Viewing Fridge For</p>
          <p className="text-2xl font-serif font-light text-stone-900">{format(selectedDate, 'EEEE, MMMM do')}</p>
        </div>

        <button
          onClick={() => setSelectedDate(addDays(selectedDate, 1))}
          className="p-4 hover:bg-stone-50 rounded-2xl transition-all"
        >
          <ChevronRight className="w-6 h-6 text-stone-400" />
        </button>
      </section>

      {/* Items List */}
      <section>
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-stone-300 animate-spin" />
          </div>
        ) : itemsOnSelectedDate.length === 0 ? (
          <div className="text-center py-20 bg-stone-100/50 rounded-[32px] border border-dashed border-stone-200">
            <Refrigerator className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-400 font-light italic">No items found in your fridge on this day.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {itemsOnSelectedDate.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-[32px] border border-stone-100 shadow-sm flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center text-stone-400">
                    <Refrigerator className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-light text-stone-900">{item.name}</h3>
                    <p className="text-xs text-stone-400 font-light italic">{item.quantity}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      <section className="bg-stone-900 p-8 rounded-[32px] text-stone-50 flex items-start gap-4">
        <Info className="w-6 h-6 text-stone-400 shrink-0 mt-1" />
        <div className="space-y-2">
          <h4 className="font-serif font-light text-xl">How this works</h4>
          <p className="text-stone-400 text-sm font-light leading-relaxed">
            The calendar shows items that were added to your fridge on or before the selected date, and either haven't been removed yet or were removed after that date. This helps you track your consumption patterns over time.
          </p>
        </div>
      </section>
    </div>
  );
}
