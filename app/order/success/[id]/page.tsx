"use client"

import React, { useEffect, useState } from 'react';
import { Check, Home, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/local/client';

const client = createClient();

interface Order {
  id: string;
  created_at: string;
  post: any
}

const OrderSuccessPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);

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
    const fetchOrder = async () => {
      try {
        const { data, error } = await client
          .from('orders')
          .select(`
            id,
            created_at,
            post (
              id,
              title,
              pictures,
              current_bid,
              description
            )
          `)
          .eq('id', id)
          .single();

        if (error) throw error;
        setOrder(data);
      } catch (err) {
        console.error('Error fetching order:', err);
        setError('Failed to load order details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  if (!authorized) {
    return null;
  }

  if (isLoading) return (
    <div className="flex justify-center items-center min-h-screen">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  );

  if (error) return (
    <div className="text-center text-red-500">{error}</div>
  );

  if (!order) return (
    <div className="text-center">Order not found</div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 mt-16 py-8">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-green-100 p-3 rounded-full">
              <Check className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Purchase Successful!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center gap-6">
            <img
              src={JSON.parse(order.post.pictures)[0]}
              alt={order.post.title}
              className="w-32 h-32 rounded-lg object-cover shadow-md"
            />
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">{order.post.title}</h3>
              <p className="text-gray-600 text-sm line-clamp-2">
                {order.post.description}
              </p>
              <p className="text-xl font-bold text-green-600">
                ${(order.post.current_bid / 100).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-500">Order Date</p>
            <p className="font-medium">
              {new Date(order.created_at).toLocaleDateString()}
            </p>
          </div>

          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => router.push('/home')}
              className="gap-2"
            >
              <Home className="w-4 h-4" />
              Return Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderSuccessPage;