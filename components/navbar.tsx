"use client"
import React, { useEffect, useState } from 'react';
import { Menu, X, User, Home, ShoppingBag, Heart, Settings, LogOut, Plus, Package, Wallet, LayoutDashboard, HelpCircle, Users, AlertCircle, UserPlus } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/local/client';
import Link from 'next/link';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const pathname = usePathname();
  const [userType, setUserType] = useState<string>('');
  const [isSuspended, setIsSuspended] = useState(false);
  const router = useRouter();
  const client = createClient();

  useEffect(() => {
    let cancelled = false;
    const loadAccount = async () => {
      const { data: { user } } = await client.auth.getUser();
      if (cancelled) return;
      setIsAuthenticated(Boolean(user));
      setEmail(user?.email ?? '');
      setUserType('');
      setIsSuspended(false);
      if (!user) return;

      const { data: userData } = await client
        .from('Users')
        .select('type, suspended')
        .eq('id', user.id)
        .single();
      if (cancelled) return;
      setUserType(userData?.type || '');
      setIsSuspended(userData?.suspended || false);
    };
    loadAccount();
    return () => { cancelled = true; };
  }, [client, pathname]);

  const hasAccess = (path: string): boolean => {
    switch (userType) {
      case 'super-user':
        return path !== '/user-sign-up';
      case 'visitor':
        return !['/bids', '/watchlist', '/reload', '/post', '/dashboard', '/issues'].includes(path);
      case 'user':
        return !['/dashboard', '/user-sign-up'].includes(path);
      case 'vip':
        return !['/dashboard', '/user-sign-up'].includes(path);
      default:
        return false;
    }
  };

  const menuItems = [
    { icon: Home, label: 'Home', href: '/home' },
    { icon: ShoppingBag, label: 'My Bids', href: '/bids' },
    { icon: Package, label: 'My Orders', href: '/order' },
    { icon: Heart, label: 'Watchlist', href: '/watchlist' },
    { icon: Wallet, label: 'Reload Balance', href: '/reload' },
    { icon: Plus, label: 'Post', href: '/post' },
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: AlertCircle, label: 'Issues', href: '/issues' },
    { icon: Users, label: 'Profile', href: '/profile' },
    { icon: UserPlus, label: 'User Sign-up', href: '/user-sign-up' },
    { icon: HelpCircle, label: 'Support', href: '/support' },
    { 
      icon: AlertCircle, 
      label: 'Reactivate Account', 
      href: '/reactivate',
      showIf: isSuspended 
    },
  ];

  const goToProfile = () => {
    router.push('/profile');
  }

  const handleLogout = async () => {
    const { error } = await client.auth.signOut();
    if (!error) {
      setIsAuthenticated(false);
      setEmail('');
      setUserType('');
      setIsSuspended(false);
      router.push('/login');
    }
  };

  const goHome = () => {
    router.push('/home');
  };

  return (
    <nav className="w-full bg-white border-b border-gray-200 fixed top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Hamburger Menu */}
          <div className="flex-shrink-0">
            <Sheet>
              <SheetTrigger asChild>
                <button
                  className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Menu className="h-6 w-6" />
                </button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  {menuItems
                    .filter(item => {
                      // Only show item if user has access AND
                      // either there's no showIf condition OR the showIf condition is true
                      return hasAccess(item.href) && 
                             (!('showIf' in item) || item.showIf === true);
                    })
                    .map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="flex items-center px-4 py-2 text-sm rounded-md hover:bg-gray-100"
                      >
                        <item.icon className="mr-3 h-5 w-5" />
                        {item.label}
                      </Link>
                    ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* App Name */}
          <Link 
            href="/home"
            className="flex-1 flex justify-center"
          >
            <span className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
              BidBay
            </span>
          </Link>

          {/* Profile Menu */}
          <div className="flex-shrink-0">
            {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Account menu"
                  className="p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <User className="h-6 w-6" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-4 py-3">
                  <p className="text-sm">Signed in as</p>
                  <p className="text-sm font-medium truncate">{email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
            
                  <span onClick={goToProfile}>Profile</span>
                </DropdownMenuItem>
            
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-red-600" 
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;