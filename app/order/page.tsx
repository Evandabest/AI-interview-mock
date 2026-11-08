"use client"

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/local/client';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from 'next/navigation';
import { Clock, DollarSign, Package, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle } from 'lucide-react';
import { Label } from "@/components/ui/label";

const client = createClient();

interface Order {
  id: string;
  created_at: string;
  shipping_address: string;
  seller: string; // Add seller field
  post: {
    id: string;
    title: string;
    pictures: string;
    current_bid: number;
  };
}

const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('newest');
  const [isReporting, setIsReporting] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [issueComment, setIssueComment] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();

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
    const fetchOrders = async () => {
      try {
        const { data: { user }, error: authError } = await client.auth.getUser();
        if (authError) throw authError;

        const { data, error } = await client
          .from('orders')
          .select(`
            *,
            post (
              id,
              title,
              pictures,
              current_bid
            )
          `)
          .eq('buyer', user?.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        console.log(data)
        setOrders(data || []);
      } catch (err) {
        setError('Failed to load orders');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleIssueSubmit = async () => {
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user || !activeOrder) return;

      const { error } = await client
        .from('issues')
        .insert({
          issuer: user.id,
          issuee: activeOrder.seller,
          order_id: activeOrder.id,
          comments: issueComment
        });

      if (error) throw error;

      setIsReporting(false);
      setIssueComment('');
      setActiveOrder(null);
      setShowSuccess(true);

      // Auto hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 5000);

    } catch (err) {
      console.error('Error submitting issue:', err);
    }
  };

  if (!authorized) {
    return null;
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center">{error}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Orders</h1>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="text-center text-gray-500">No orders found</div>
        ) : (
          orders.map((order) => (
            <Card key={order.id} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex gap-6">
                  <img
                    src={JSON.parse(order.post.pictures)[0]}
                    alt={order.post.title}
                    className="w-32 h-32 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">{order.post.title}</h3>
                        <p className="text-sm text-gray-500">
                          Order placed: {formatDate(order.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">
                          ${(order.post.current_bid / 100).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-sm">
                        <div className="font-medium mb-1">Shipping Address</div>
                        <p>
                          {(() => {
                            const address = JSON.parse(order.shipping_address);
                            return (
                              <>
                                {address.firstName} {address.lastName}<br />
                                {address.streetAddress}<br />
                                {address.city}, {address.state} {address.zipCode}
                              </>
                            );
                          })()}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-between items-center">
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/post/${order.post.id}`)}
                      >
                        View Item Details
                      </Button>
                      <Dialog open={isReporting && activeOrder?.id === order.id} onOpenChange={(open) => {
                        if (!open) {
                          setIsReporting(false);
                          setActiveOrder(null);
                          setIssueComment('');
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            className="text-red-500 hover:text-red-600"
                            onClick={() => {
                              setIsReporting(true);
                              setActiveOrder(order);
                            }}
                          >
                            <AlertCircle className="w-4 h-4 mr-2" />
                            Report Issue
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Report Issue</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Describe the Issue</Label>
                              <Textarea
                                placeholder="Please describe the issue you're experiencing..."
                                value={issueComment}
                                onChange={(e) => setIssueComment(e.target.value)}
                                className="min-h-[100px]"
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setIsReporting(false);
                                setActiveOrder(null);
                                setIssueComment('');
                              }}
                            >
                              Cancel
                            </Button>
                            <Button 
                              onClick={handleIssueSubmit}
                              disabled={!issueComment.trim()}
                            >
                              Submit Report
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-green-600 flex items-center gap-2">
              <Check className="w-5 h-5" />
              Issue Reported Successfully
            </DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Your issue has been reported to the seller and will be reviewed by our moderation team.
            We will get back to you soon.
          </p>
          <DialogFooter>
            <Button onClick={() => setShowSuccess(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdersPage;