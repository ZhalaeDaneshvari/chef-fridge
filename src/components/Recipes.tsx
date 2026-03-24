import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { generateRecipes, Recipe } from '../services/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { ChefHat, Loader2, Sparkles, Bookmark, Trash2, Flame, Beef, Wheat, Droplets, ChevronRight, Refrigerator } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

export function Recipes({ user }: { user: User }) {
  const [fridgeItems, setFridgeItems] = useState<any[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<any[]>([]);
  const [generatedRecipes, setGeneratedRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [userPreferences, setUserPreferences] = useState({ likes: [], dislikes: [], dietaryRestrictions: [] });

  useEffect(() => {
    // Fetch fridge items
    const fridgeUnsubscribe = onSnapshot(collection(db, 'users', user.uid, 'fridgeItems'), (snapshot) => {
      setFridgeItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch saved recipes
    const recipesUnsubscribe = onSnapshot(
      query(collection(db, 'users', user.uid, 'recipes'), orderBy('savedAt', 'desc')), 
      (snapshot) => {
        setSavedRecipes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }
    );

    // Fetch user preferences
    const fetchPrefs = async () => {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserPreferences(docSnap.data().preferences || { likes: [], dislikes: [], dietaryRestrictions: [] });
      }
    };
    fetchPrefs();

    return () => {
      fridgeUnsubscribe();
      recipesUnsubscribe();
    };
  }, [user.uid]);

  const handleGenerateRecipes = async () => {
    if (fridgeItems.length === 0) {
      toast.error("Add some items to your fridge first!");
      return;
    }

    setGenerating(true);
    try {
      const ingredients = fridgeItems.map(item => item.name);
      const savedTitles = savedRecipes.map(r => r.title);
      const recipes = await generateRecipes(ingredients, userPreferences, savedTitles);
      setGeneratedRecipes(recipes);
      toast.success("Recipes generated!");
    } catch (error) {
      console.error("Error generating recipes:", error);
      toast.error("Failed to generate recipes. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveRecipe = async (recipe: Recipe) => {
    try {
      await addDoc(collection(db, 'users', user.uid, 'recipes'), {
        ...recipe,
        savedAt: serverTimestamp()
      });
      toast.success("Recipe saved!");
    } catch (error) {
      toast.error("Failed to save recipe");
    }
  };

  const handleDeleteRecipe = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'recipes', id));
      toast.success("Recipe removed");
    } catch (error) {
      toast.error("Failed to remove recipe");
    }
  };

  return (
    <div className="space-y-12 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-serif font-light tracking-tight">AI Recipes</h2>
          <p className="text-stone-500 font-light italic">Personalized meals based on your fridge</p>
        </div>
        <button
          onClick={handleGenerateRecipes}
          disabled={generating || fridgeItems.length === 0}
          className="h-[60px] px-8 bg-stone-900 text-stone-50 rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-stone-800 disabled:opacity-50 transition-all shadow-lg shadow-stone-200"
        >
          {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          Generate Recipes
        </button>
      </header>

      {/* Generated Recipes */}
      <AnimatePresence>
        {generatedRecipes.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <h3 className="text-xl font-serif font-light text-stone-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-stone-400" />
              New Suggestions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {generatedRecipes.map((recipe, idx) => (
                <RecipeCard 
                  key={idx} 
                  recipe={recipe} 
                  onSave={() => handleSaveRecipe(recipe)}
                  isGenerated
                />
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Saved Recipes */}
      <section className="space-y-6">
        <h3 className="text-xl font-serif font-light text-stone-900 flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-stone-400" />
          Saved Recipes
        </h3>
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-stone-300 animate-spin" />
          </div>
        ) : savedRecipes.length === 0 ? (
          <div className="text-center py-20 bg-stone-100/50 rounded-[32px] border border-dashed border-stone-200">
            <ChefHat className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-400 font-light italic">No saved recipes yet. Generate some to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedRecipes.map((recipe) => (
              <RecipeCard 
                key={recipe.id} 
                recipe={recipe} 
                onDelete={() => handleDeleteRecipe(recipe.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RecipeCard({ recipe, onSave, onDelete, isGenerated }: { 
  recipe: any; 
  onSave?: () => void; 
  onDelete?: () => void;
  isGenerated?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      className="bg-white rounded-[32px] border border-stone-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col"
    >
      <div className="p-6 space-y-4 flex-1">
        <div className="flex justify-between items-start">
          <h4 className="text-xl font-serif font-light text-stone-900 leading-tight">{recipe.title}</h4>
          {isGenerated ? (
            <button
              onClick={onSave}
              className="p-2 text-stone-300 hover:text-stone-900 hover:bg-stone-50 rounded-xl transition-all"
            >
              <Bookmark className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={onDelete}
              className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="bg-stone-50 p-2 rounded-xl text-center">
            <Flame className="w-3 h-3 text-orange-400 mx-auto mb-1" />
            <p className="text-[10px] font-bold text-stone-900">{recipe.nutrition.calories}</p>
          </div>
          <div className="bg-stone-50 p-2 rounded-xl text-center">
            <Beef className="w-3 h-3 text-red-400 mx-auto mb-1" />
            <p className="text-[10px] font-bold text-stone-900">{recipe.nutrition.protein}g</p>
          </div>
          <div className="bg-stone-50 p-2 rounded-xl text-center">
            <Wheat className="w-3 h-3 text-amber-400 mx-auto mb-1" />
            <p className="text-[10px] font-bold text-stone-900">{recipe.nutrition.carbs}g</p>
          </div>
          <div className="bg-stone-50 p-2 rounded-xl text-center">
            <Droplets className="w-3 h-3 text-blue-400 mx-auto mb-1" />
            <p className="text-[10px] font-bold text-stone-900">{recipe.nutrition.fat}g</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-stone-400">Ingredients</p>
          <div className="flex flex-wrap gap-1">
            {recipe.ingredients.slice(0, 4).map((ing: string, i: number) => (
              <span key={i} className="px-2 py-1 bg-stone-50 text-[10px] text-stone-600 rounded-lg">{ing}</span>
            ))}
            {recipe.ingredients.length > 4 && (
              <span className="px-2 py-1 bg-stone-50 text-[10px] text-stone-400 rounded-lg">+{recipe.ingredients.length - 4} more</span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full py-4 px-6 border-t border-stone-50 flex items-center justify-between text-xs font-medium text-stone-500 hover:bg-stone-50 transition-all"
      >
        {expanded ? "Hide Instructions" : "View Instructions"}
        <ChevronRight className={cn("w-4 h-4 transition-transform", expanded && "rotate-90")} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-stone-50/50"
          >
            <div className="p-6 text-sm text-stone-600 font-light leading-relaxed prose prose-stone prose-sm">
              <ReactMarkdown>{recipe.instructions}</ReactMarkdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
