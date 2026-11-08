'use client'

import React, { useState, useEffect } from 'react';
import { Clock, DollarSign, Award, User } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from '@/lib/local/client';
import { useRouter } from 'next/navigation';
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Add enum type to match database
type PostStatus = 'active' | 'ending-soon' | 'ended' | 'completed';

// Update Post type
type Post = {
  id: string;
  poster_id: string;
  poster: {
    username: string;
    rating: number;
  };
  title: string;
  starting_bid: number;
  current_bid: number;
  highest_bidder: string | null;
  expire: string;
  pictures: string;
  description: string;
  status: PostStatus;
}

const client = createClient();

// Use constants for price ranges
const PRICE_RANGES = {
  UNDER_100: 10000, // 100 dollars in cents
  OVER_500: 50000   // 500 dollars in cents
};

const HomePage = () => {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priceRange, setPriceRange] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [userType, setUserType] = useState<string>('');

  useEffect(() => {
    const fetchPosts = async () => {
      const { data, error } = await client
        .from('post')
        .select(`
          *,
          poster:Users!poster_id (
            username,
            rating,
          )
        `)
        .neq('status', 'completed') // Exclude completed posts
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching posts:', error);
        return;
      }

      // Transform data to ensure poster object exists
      const transformedData = data?.map((post: Post) => ({
        ...post,
        poster: post.poster || {
          username: 'Unknown User',
          rating: 0,
        }
      })) || [];

      setPosts(transformedData);
      setLoading(false);
    };

    fetchPosts();
  }, []);
  
  useEffect(() => {
    const getUserType = async () => {
      const { data: { user }, error } = await client.auth.getUser();
      if (user) {
        const { data: userData } = await client
          .from('Users')
          .select('type')
          .eq('id', user.id)
          .single();
        setUserType(userData?.type || '');
      }
    };
    getUserType();
  }, []);

  // Add status update logic for "ending-soon"
  const updatePostStatus = (post: Post) => {
    const timeLeft = new Date(post.expire).getTime() - Date.now();
    return timeLeft < 24 * 60 * 60 * 1000 ? 'ending-soon' : post.status;
  };

  // Update getStatusVariant
  const getStatusVariant = (status: Post['status']) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'ending-soon':
        return 'secondary';
      case 'ended':
        return 'destructive';
      case 'completed':
        return 'outline';
      default:
        return 'default';
    }
  };
  const RatingStars = ({ rating }: { rating: number }) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-5 h-5 ${
              star <= rating ? 'text-yellow-400' : 'text-gray-300'
            }`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        <span className="text-sm text-gray-600 ml-2">({rating.toFixed(1)})</span>
      </div>
    );
  };

  const getFilteredAndSortedPosts = () => {
    let filtered = posts.filter(post => 
      post.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(post => post.status === statusFilter);
    }

    // Price range filter
    if (priceRange !== 'all') {
      switch(priceRange) {
        case 'under100':
          filtered = filtered.filter(post => post.current_bid < PRICE_RANGES.UNDER_100); // cents
          break;
        case '100to500':
          filtered = filtered.filter(post => post.current_bid >= 10000 && post.current_bid <= PRICE_RANGES.OVER_500);
          break;
        case 'over500':
          filtered = filtered.filter(post => post.current_bid > PRICE_RANGES.OVER_500);
          break;
      }
    }

    // Time remaining filter
    if (timeFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(post => {
        const timeLeft = new Date(post.expire).getTime() - now.getTime();
        switch(timeFilter) {
          case 'ending-soon':
            return timeLeft <= 24 * 60 * 60 * 1000; // 24 hours
          case 'day':
            return timeLeft <= 24 * 60 * 60 * 1000;
          case 'week':
            return timeLeft <= 7 * 24 * 60 * 60 * 1000;
          default:
            return true;
        }
      });
    }

    // Sorting
    return filtered.sort((a, b) => {
      switch(sortBy) {
        case 'newest':
          return new Date(b.expire).getTime() - new Date(a.expire).getTime();
        case 'oldest':
          return new Date(a.expire).getTime() - new Date(b.expire).getTime();
        case 'price-high':
          return b.current_bid - a.current_bid;
        case 'price-low':
          return a.current_bid - b.current_bid;
        default:
          return 0;
      }
    });
  };

  const UpgradeBanner = () => (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-blue-800">
            Upgrade to User Account
          </h3>
          <p className="text-sm text-blue-600">
            Get full access to bidding and selling features!
          </p>
        </div>
        <Button 
          onClick={() => router.push('/user-sign-up')}
          className="bg-blue-500 hover:bg-blue-600"
        >
          Sign Up Now
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto mt-20 px-4">
      {userType === 'visitor' && <UpgradeBanner />}
      <div className="sticky top-16 z-10 bg-background py-4 space-y-4">
        <Input
          type="text"
          placeholder="Search listings..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xl mx-auto"
        />
        
        <div className="flex flex-wrap gap-4 justify-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="ending-soon">Ending Soon</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priceRange} onValueChange={setPriceRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Price range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Prices</SelectItem>
              <SelectItem value="under100">Under $100</SelectItem>
              <SelectItem value="100to500">$100 - $500</SelectItem>
              <SelectItem value="over500">Over $500</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Time remaining" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="ending-soon">Ending Soon</SelectItem>
              <SelectItem value="day">24 Hours</SelectItem>
              <SelectItem value="week">1 Week</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16 p-6">
        {getFilteredAndSortedPosts().map((post) => (
          <Card 
            key={post.id}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push(`/post/${post.id}`)}
          >
            <CardHeader>
              <img 
                src={JSON.parse(post.pictures)[0] || '/placeholder.jpg'}
                alt={post.title}
                className="w-full h-48 object-cover rounded-t-lg"
              />
            </CardHeader>
            <CardContent>
              <CardTitle className="mb-2">{post.title}</CardTitle>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span>{post.poster?.username || 'Unknown User'}</span>
                  {post.poster?.rating && (
                    <RatingStars rating={post.poster.rating} />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span>Current Bid: ${(post.current_bid / 100).toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{new Date(post.expire).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Badge 
                variant={getStatusVariant(post.status)}
                className={`
                  ${post.status === 'active' ? 'bg-green-500 hover:bg-green-600' : ''}
                  ${post.status === 'ending-soon' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
                  ${post.status === 'ended' ? 'bg-red-500 hover:bg-red-600' : ''}
                `}
              >
                {post.status}
              </Badge>
              <Button variant="outline">Place Bid</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default HomePage;