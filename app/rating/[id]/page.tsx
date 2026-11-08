"use client"

import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/local/client';

const client = createClient();

const StarIcon = ({ className }: { className?: string }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
  >
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const StarFilledIcon = ({ className }: { className?: string }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="currentColor"
  >
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

interface Review {
  reviewer: string;
  reviewee: string;
  comments: string | null;
  rate: number;
  order_id: string;
}

interface Order {
  id: string;
  seller: string;
}

const RatingPage = () => {
  const { id } = useParams();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellerInfo, setSellerInfo] = useState({ 
    username: '', 
  });
  const [order, setOrder] = useState<Order | null>(null);
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
    const fetchOrder = async () => {
      // First get order details
      const { data: orderData, error: orderError } = await client
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

      if (orderError) {
        setError('Order not found');
        return;
      }

      setOrder(orderData);

      // Then fetch seller info
      const { data: sellerData, error: sellerError } = await client
        .from('Users')
        .select('username')
        .eq('id', orderData.seller)
        .single();

      if (!sellerError && sellerData) {
        setSellerInfo({
          username: sellerData.username,
        });
      }

      setIsLoading(false);
    };

    fetchOrder();
  }, [id]);

  // Update the seller's rating and handle bad reviews
    const updateSellerRating = async () => {
    if (!order) return;
  
    try {
      const { data: reviews, error: reviewsError } = await client
        .from('reviews')
        .select('rate')
        .eq('reviewee', order.seller);
  
      if (reviewsError) throw reviewsError;
  
      // Handle no reviews case
      if (!reviews || reviews.length === 0) {
        const { error: updateError } = await client
          .from('Users')
          .update({ rating: rating })
          .eq('id', order.seller);
  
        if (updateError) throw updateError;
        return;
      }
  
      // Calculate average including new rating
      const totalRating = reviews.reduce((acc: number, review: { rate: number }) => acc + (review.rate || 0), 0);
      const averageRating = (totalRating + rating) / (reviews.length + 1);
  
      const { error: updateError } = await client
        .from('Users')
        .update({ rating: averageRating })
        .eq('id', order.seller);
  
      if (updateError) throw updateError;
  
      // Handle bad reviews
      if (rating <= 2) {
        const { data: sellerData, error: sellerError } = await client
          .from('Users')
          .select('bad_review, suspended, type')
          .eq('id', order.seller)
          .single();
  
        if (sellerError) throw sellerError;
  
        let { bad_review, suspended, type } = sellerData;
  
        if (type === 'vip') {
          // Downgrade VIP user to regular user
          const { error: downgradeError } = await client
            .from('Users')
            .update({ bad_review: 0, type: 'user', warning: true })
            .eq('id', order.seller);
  
          if (downgradeError) throw downgradeError;
        } else if (bad_review >= 3) {
          // Reset bad reviews and suspend the seller
          const { error: suspendError } = await client
            .from('Users')
            .update({ bad_review: 0, suspended: true, warning: true })
            .eq('id', order.seller);
  
          if (suspendError) throw suspendError;
        } else {
          // Increment bad reviews and set warning
          const { error: badReviewError } = await client
            .from('Users')
            .update({ bad_review: bad_review + 1, warning: true })
            .eq('id', order.seller);
  
          if (badReviewError) throw badReviewError;
        }
      }
    } catch (err) {
      console.error('Error updating seller rating:', err);
      throw err;
    }
  };
  const handleSubmit = async () => {
    if (!order) return;

    try {
      setIsLoading(true);
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const reviewData: Review = {
        reviewer: user.id,
        reviewee: order.seller,
        order_id: id as string,
        comments: comment || null,
        rate: rating
      };

      const { error: reviewError } = await client
        .from('reviews')
        .insert(reviewData);

      if (reviewError) throw reviewError;

      await updateSellerRating();
      router.push(`/order/success/${id}`);
    } catch (err) {
      console.error('Submit error:', err);
      setError('Failed to submit review');
    } finally {
      setIsLoading(false);
    }
  };

  if (!authorized) {
    return null;
  }

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;
  if (!order) return <div>Order not found</div>;

  return (
    <div className="max-w-2xl mt-16 mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-center">
            How would you rate your shopping experience with {sellerInfo.username}?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <span className="text-lg font-medium">{sellerInfo.username}</span>
            </div>
            <div className="text-sm text-gray-500">
              How would you rate your experience?
            </div>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="text-2xl focus:outline-none transition-colors duration-200 hover:scale-110"
                >
                  {star <= rating ? (
                    <StarFilledIcon className="w-8 h-8 text-yellow-400" />
                  ) : (
                    <StarIcon className="w-8 h-8 text-gray-300" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <textarea
            placeholder="Leave a comment (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
          />

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!rating || isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Check className="w-4 h-4 animate-spin" />
                Submitting...
              </span>
            ) : (
              'Submit Review'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default RatingPage;