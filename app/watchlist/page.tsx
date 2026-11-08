"use client"

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/local/client';
import { useRouter } from 'next/navigation';
import { Clock, Heart, ArrowUp, ArrowDown, AlertCircle, DollarSign } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";


interface WatchlistItem {
  id: string;
  post: {
    id: string;
    title: string;
    current_bid: number;
    starting_bid: number;
    expire: string;
    status: 'active' | 'completed';
    description: string;
    pictures: string;
  }
}

interface Bid {
  created_at: string;
  bid_amount: number;
  bidder: {
    username: string;
  }
}

export default function WatchlistPage() {
  const [watchlistItems, setWatchlistItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidHistory, setBidHistory] = useState<any[]>([]);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const client = createClient();
  const router = useRouter();

  const formatCurrency = (amount: number) => {
    return (amount / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD'
    });
  };

  const getTimeLeft = (expireDate: string) => {
    const now = new Date();
    const expire = new Date(expireDate);
    const diff = expire.getTime() - now.getTime();
  
    if (diff <= 0) return 'Expired';
  
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const fetchBidHistory = async (postId: string) => {
    const { data, error } = await client
      .from('bids')
      .select(`
        created_at,
        bid_amount,
        bidder:bidder_id(username)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      setBidHistory(prev => ({
        ...prev,
        [postId]: data
      }));
    }
  };

  const formatBidTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  };

  useEffect(() => {
    const checkAuthorization = async () => {
      const { data: { user }, error: authError } = await client.auth.getUser();
      
      if (authError || !user) {
        router.push('/home');
        return;
      }
  
      const { data: userData, error: userError } = await client
        .from('Users')
        .select('type')
        .eq('id', user.id)
        .single();
  
      if (userError || userData?.type === 'visitor') {
        router.push('/home');
        return;
      }
  
      setAuthorized(true);
    };
  
    checkAuthorization();
  }, []);

  useEffect(() => {
    async function fetchWatchlist() {
      const { data: { session } } = await client.auth.getSession();
      
      if (session) {
        const { data, error } = await client
          .from('watchlist')
          .select(`
            id,
            post:post_id (
              id,
              title,
              current_bid,
              starting_bid,
              expire,
              status,
              description,
              pictures
            )
          `)
          .eq('user_id', session.user.id);

        if (data) setWatchlistItems(data);
      }
      setLoading(false);
    }

    fetchWatchlist();
  }, []);

  const handleRemoveFromWatchlist = async (watchlistId: string) => {
    const { error } = await client
      .from('watchlist')
      .delete()
      .eq('id', watchlistId);

    if (!error) {
      setWatchlistItems(prev => prev.filter(item => item.id !== watchlistId));
    }
  };

  if (loading) return <div>Loading...</div>;

  if (!authorized) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 mt-16">
      {watchlistItems.map((item) => (
        <Card key={item.id} className="relative">
          <div 
            className="cursor-pointer" 
            onClick={() => router.push(`/post/${item.post.id}`)}
          >
            <CardHeader>
              <CardTitle>
                {item.post.title}
              </CardTitle>
              <div className="flex justify-between items-center absolute top-4 right-4 gap-2">
                <span className={`text-sm px-2 py-1 rounded ${
                  item.post.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {item.post.status}
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Remove from watchlist?')) {
                      handleRemoveFromWatchlist(item.id);
                    }
                  }}
                >
                  Remove
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {item.post.pictures && JSON.parse(item.post.pictures)[0] && (
                <img 
                  src={JSON.parse(item.post.pictures)[0]} 
                  alt={item.post.title}
                  className="w-full h-48 object-cover mb-4 rounded"
                />
              )}
              <div className="space-y-2">
                <div className="flex flex-row space-x-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <span>Starting Bid: {formatCurrency(item.post.starting_bid)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowUp className="h-4 w-4" />
                    <span>Current Bid: {formatCurrency(item.post.current_bid)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Time Left: {getTimeLeft(item.post.expire)}</span>
                </div>
              </div>
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (expandedPost === item.post.id) {
                      setExpandedPost(null);
                    } else {
                      setExpandedPost(item.post.id);
                      fetchBidHistory(item.post.id);
                    }
                  }}
                >
                  {expandedPost === item.post.id ? 'Hide Bid History' : 'Show Bid History'}
                </Button>
                
                {expandedPost === item.post.id && (
                  <div className="mt-2 space-y-2" onClick={e => e.stopPropagation()}>
                    {bidHistory[item.post.id]?.length ? (
                      bidHistory[item.post.id].map((bid: Bid, index: number) => (
                        <div key={index} className="text-sm border-b pb-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">
                              {formatBidTime(bid.created_at)}
                            </span>
                            <span className="font-medium">
                              {formatCurrency(bid.bid_amount)}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500">No bids yet</div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </div>
        </Card>
      ))}
    </div>
  );
}