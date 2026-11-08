"use client"

import React, { useState, useEffect } from 'react';
import { 
  Clock,
  History,
  Trophy,
  AlertCircle,
  DollarSign,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { createClient } from '@/lib/local/client';
import { useRouter } from 'next/navigation';

const client = createClient()

// Types
interface BidHistory {
  amount: number;
  date: string;
  wasLeading: boolean;
}

interface BidItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  currentBid: number;
  userHighestBid: number;
  startingPrice: number;
  endTime: string;
  timeLeft: string;
  status: 'active' | 'won' | 'outbid' | 'ended' | 'completed';
  totalBids: number;
  bidHistory: BidHistory[];
  isLeading: boolean;
  reservePrice: number;
}

interface DatabaseBid {
  id: string;
  created_at: string;
  bid_amount: number;
  post_id: string;
  bidder_id: string;
}

interface DatabasePost {
  id: string;
  title: string;
  description: string;
  pictures: string;
  current_bid: number;
  starting_bid: number;
  expire: string;
  status: 'active' | 'completed';
  highest_bidder: string;
}

// Function to get unique bids based on bid amount
const getUniqueBids = (bids: DatabaseBid[]) => {
  // Create Map with bid_amount as key to keep only latest bid of each amount
  const uniqueBidsMap = new Map();
  
  bids.forEach(bid => {
    if (!uniqueBidsMap.has(bid.bid_amount) || 
        new Date(bid.created_at) > new Date(uniqueBidsMap.get(bid.bid_amount).created_at)) {
      uniqueBidsMap.set(bid.bid_amount, bid);
    }
  });

  // Convert map back to array and sort by date
  return Array.from(uniqueBidsMap.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

// Function to get unique listings based on post_id
const getUniqueListings = (bids: any[]) => {
  // Group bids by post_id
  const postGroups = bids.reduce((groups: any, bid) => {
    const postId = bid.post.id;
    if (!groups[postId] || new Date(bid.created_at) > new Date(groups[postId].created_at)) {
      groups[postId] = bid;
    }
    return groups;
  }, {});

  // Convert back to array
  return Object.values(postGroups);
};

// Function to format currency from cents to dollars
const formatCurrency = (cents: number): string => {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const MyBidsPage = () => {
  // State to store bid items
  const [bidItems, setBidItems] = useState<BidItem[]>([]);
  // State to manage loading state
  const [loading, setLoading] = useState(true);
  // State to store error messages
  const [error, setError] = useState<string | null>(null);
  const client = createClient();
  const router = useRouter();
  // State to store current user ID
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  // Fetch user data on component mount
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await client.auth.getUser();
      if (user) {
        setCurrentUser(user.id);
      }
    };
    fetchUser();
  }, []);

  // Fetch bids data on component mount and when currentUser changes
  useEffect(() => {
    const fetchBids = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await client.auth.getSession();
        if (!session) {
          setError('Please login to view your bids');
          return;
        }

        const { data: userBids, error: bidsError } = await client
          .from('bids')
          .select(`
            *,
            post:post_id (
              id,
              title,
              description,
              pictures,
              current_bid,
              starting_bid,
              expire,
              status,
              highest_bidder
            )
          `)
          .eq('bidder_id', session.user.id)
          .order('created_at', { ascending: false });

        if (bidsError) throw bidsError;

        // Get unique listings before transformation
        const uniqueListings = getUniqueListings(userBids || []);

        // Transform unique listings
        const transformedBids = await Promise.all(uniqueListings.map(async (bid: any) => {
          const { data: postBids } = await client
            .from('bids')
            .select('*')
            .eq('post_id', bid.post.id)
            .order('created_at', { ascending: false });

          const userHighestBid = Math.max(...(userBids || [])
            .filter((b: { post: { id: string } }) => b.post.id === bid.post.id)
            .map((b: { bid_amount: number }) => b.bid_amount));

          const isLeading = bid.post.highest_bidder === session.user.id;

          return {
            id: bid.post.id,
            title: bid.post.title,
            description: bid.post.description,
            imageUrl: JSON.parse(bid.post.pictures)[0] || '',
            currentBid: bid.post.current_bid,
            userHighestBid,
            startingPrice: bid.post.starting_bid,
            endTime: bid.post.expire,
            timeLeft: getTimeLeft(bid.post.expire),
            status: getStatus(bid.post.status, isLeading, bid.post.expire),
            totalBids: postBids?.length || 0,
            isLeading,
            reservePrice: bid.post.starting_bid * 1.5, 
            bidHistory: getUniqueBids(postBids || []).map(b => ({
              amount: b.bid_amount,
              date: b.created_at,
              wasLeading: b.bidder_id === session.user.id
            })) || []
          };
        }));

        setBidItems(transformedBids);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch bids');
      } finally {
        setLoading(false);
      }
    };

    fetchBids();
  }, [currentUser]);

  // Function to get the status of a bid item
  const getStatus = (postStatus: string, isLeading: boolean, endTime: string): BidItem['status'] => {
    if (postStatus === 'completed') {
      return 'completed';
    }
    if (new Date(endTime) < new Date()) {
      return isLeading ? 'won' : 'ended';
    }
    return isLeading ? 'active' : 'outbid';
  };

  // Function to get the time left for a bid item
  const getTimeLeft = (expireDate: string) => {
    const now = new Date();
    const expire = new Date(expireDate);
    const diff = expire.getTime() - now.getTime();

    if (diff <= 0) return 'Ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  // Function to check if an auction has ended
  const isAuctionEnded = (expireDate: string) => {
    return new Date(expireDate).getTime() < new Date().getTime();
  };

  // State to store filter value
  const [filter, setFilter] = useState("all");
  // State to store sort by value
  const [sortBy, setSortBy] = useState("timeLeft");

  // Function to get the status badge for a bid item
  const getStatusBadge = (status: BidItem['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-blue-500">Active</Badge>;
      case 'won':
        return <Badge className="bg-green-500">Won</Badge>;
      case 'outbid':
        return <Badge className="bg-red-500">Outbid</Badge>;
      case 'ended':
        return <Badge className="bg-gray-500">Ended</Badge>;
      case 'completed':
        return <Badge className="bg-gray-500">Completed</Badge>;
    }
  };

  // Function to format date string
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Function to sort bid items based on sort by value
  const sortItems = (a: BidItem, b: BidItem, sortBy: string) => {
    switch (sortBy) {
      case 'priceAsc':
        return a.currentBid - b.currentBid;
      case 'priceDesc':
        return b.currentBid - a.currentBid;
      case 'timeLeft':
        return new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
      default:
        return 0;
    }
  };

  // Filter and sort bid items based on filter and sort by values
  const filteredAndSortedItems = bidItems
    .filter(item => filter === 'all' || item.status === filter)
    .sort((a, b) => sortItems(a, b, sortBy));

  // Function to handle listing click
  const handleListingClick = (listingId: string) => {
    router.push(`/post/${listingId}`);
  };

  return (
    <div className="max-w-4xl mx-auto mt-16 p-4 space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold">My Bids</h1>
        
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bids</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="outbid">Outbid</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="timeLeft">Time Left</SelectItem>
              <SelectItem value="priceAsc">Price: Low to High</SelectItem>
              <SelectItem value="priceDesc">Price: High to Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      )}

      {filteredAndSortedItems.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No bids found</AlertTitle>
          <AlertDescription>
            You haven't placed any bids yet. Start bidding to see your bid history here.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          {filteredAndSortedItems.map((item) => (
            <Card key={item.id}>
              <div 
                onClick={() => handleListingClick(item.id)}
                className="cursor-pointer"
              >
                <div className="flex flex-col md:flex-row">
                  <div className="w-full md:w-48 h-48">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 p-4">
                    <div className="flex flex-col md:flex-row justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-semibold">{item.title}</h2>
                          {getStatusBadge(item.status)}
                        </div>
                        <p className="text-sm text-gray-500">{item.description}</p>
                      </div>
                      <div className="flex items-start gap-2">
                        {item.isLeading && (
                          <Badge variant="outline" className="border-green-500 text-green-500">
                            <Trophy className="w-3 h-3 mr-1" />
                            Leading Bid
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-gray-500">Current Bid</div>
                        <div className="font-semibold flex items-center">
                          <DollarSign className="h-4 w-4" />
                          {formatCurrency(item.currentBid)}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-500">Your Highest Bid</div>
                        <div className="font-semibold flex items-center">
                          <DollarSign className="h-4 w-4" />
                          {formatCurrency(item.userHighestBid)}
                          {item.isLeading ? (
                            <ArrowUp className="h-4 w-4 text-green-500 ml-1" />
                          ) : (
                            <ArrowDown className="h-4 w-4 text-red-500 ml-1" />
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-500">Total Bids</div>
                        <div className="font-semibold">{item.totalBids}</div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-500">Time Left</div>
                        <div className="font-semibold flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {item.timeLeft}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-sm text-gray-500 mb-1">Price Progress</div>
                      <Progress 
                        value={((item.currentBid - item.startingPrice) / (item.reservePrice - item.startingPrice)) * 100}
                        className="h-2"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Start: {formatCurrency(item.startingPrice)}</span>
                        <span>Reserve: {formatCurrency(item.reservePrice)}</span>
                      </div>
                    </div>

                    <Collapsible className="mt-4">
                      <CollapsibleTrigger 
                        className="flex items-center gap-2 text-sm text-gray-500"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent navigation when clicking bid history
                        }}
                      >
                        <History className="h-4 w-4" />
                        Bid History
                        <ChevronDown className="h-4 w-4" />
                      </CollapsibleTrigger>
                      <CollapsibleContent 
                        className="mt-2"
                        onClick={(e) => e.stopPropagation()} // Prevent navigation when clicking content
                      >
                        <div className="space-y-2">
                          {item.bidHistory.map((bid, index) => (
                            <div 
                              key={index}
                              className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded"
                            >
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-3 w-3" />
                                {formatCurrency(bid.amount)}
                                {bid.wasLeading && (
                                  <Badge variant="outline" className="text-xs">Leading</Badge>
                                )}
                              </div>
                              <div className="text-gray-500">
                                {formatDate(bid.date)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {item.status === 'active' && (
                      <div className="mt-4">
                        <Button className="w-full md:w-auto">
                          Place New Bid
                        </Button>
                      </div>
                    )}
                    {currentUser && 
                      item.isLeading && 
                      isAuctionEnded(item.endTime) &&
                      item.status !== 'completed' && ( // Add this condition
                        <Button 
                          className="w-full mt-4 bg-green-600 hover:bg-green-700 text-black shadow-lg border-2 border-cool-gray-200"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent navigation to post detail
                            router.push(`/checkout/${item.id}`);
                          }}
                        >
                          Proceed to Checkout
                        </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyBidsPage;