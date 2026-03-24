import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User } from 'firebase/auth';
import { logout } from '../firebase';
import { ChefHat, Refrigerator, User as UserIcon, LogOut, History, Calendar as CalendarIcon, Activity, ShoppingCart } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export function Layout({ children, user }: { children: ReactNode; user: User }) {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Refrigerator, label: 'Fridge' },
    { path: '/grocery', icon: ShoppingCart, label: 'Grocery List' },
    { path: '/recipes', icon: ChefHat, label: 'Recipes' },
    { path: '/history', icon: History, label: 'History Log' },
    { path: '/calendar', icon: CalendarIcon, label: 'Calendar' },
    { path: '/fitness', icon: Activity, label: 'Fitness' },
    { path: '/profile', icon: UserIcon, label: 'Profile' },
  ];

  return (
    <div className="flex h-screen bg-stone-50 text-stone-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-stone-200 flex flex-col p-6 bg-white">
        <div className="flex items-center gap-3 mb-12">
          <ChefHat className="w-8 h-8 text-stone-800" />
          <h1 className="text-xl font-serif font-light tracking-tight">ChefFridge</h1>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200",
                  isActive 
                    ? "bg-stone-900 text-stone-50 shadow-lg shadow-stone-200" 
                    : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-stone-100">
          <div className="flex items-center gap-3 px-4 py-3 mb-4">
            <img 
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
              className="w-8 h-8 rounded-full"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-stone-400 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-stone-500 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-8 lg:p-12">
          {children}
        </div>
      </main>
    </div>
  );
}
