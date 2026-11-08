"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/local/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useParams } from 'next/navigation';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';

const client = createClient();

interface Issue {
  id: string;
  created_at: string;
  comments: string;
  response: Array<{
    username: string;
    message: string;
    timestamp: string;
  }> | null;
  issuer: {
    id: string;
    username: string;
  };
  order_id: string;
  status: string;
}

interface Order {
  id: string;
  created_at: string;
  buyer: string;
  seller: string;
  post: {
    id: string;
    title: string;
    pictures: string;
    current_bid: number;
  } | null;
  shipping_address: string;
}

interface Post {
  id: string;
  title: string;
  pictures: string;
  description: string;
  current_bid: number;
}

const IssuePage = () => {
  const router = useRouter();
  const { id } = useParams();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [buyerUsername, setBuyerUsername] = useState<string>('');
  const [sellerUsername, setSellerUsername] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newResponse, setNewResponse] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);
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
    const fetchIssueDetails = async () => {
      try {
        if (!id) return;

        // Fetch current user
        const { data: { user }, error: userError } = await client.auth.getUser();
        if (userError) throw userError;
        setCurrentUser(user);

        // Fetch issue details
        const { data: issueData, error: issueError } = await client
          .from('issues')
          .select(`
            id,
            created_at,
            comments,
            response,
            issuer ( id, username ),
            order_id,
            status
          `)
          .eq('id', id)
          .single();

        if (issueError) throw issueError;

        // Parse the response field if it's a string
        if (typeof issueData.response === 'string') {
          issueData.response = JSON.parse(issueData.response || '[]');
        }

        setIssue(issueData);

        if (issueData.order_id) {
          // Fetch order details
          const { data: orderData, error: orderError } = await client
            .from('orders')
            .select(`
              id,
              created_at,
              buyer,
              seller,
              post (
                id,
                title,
                pictures,
                current_bid
              ),
              shipping_address
            `)
            .eq('id', issueData.order_id)
            .single();

          if (orderError) throw orderError;
          setOrder(orderData);

          // Fetch buyer's username
          const { data: buyerData, error: buyerError } = await client
            .from('Users')
            .select('username')
            .eq('id', orderData.buyer)
            .single();

          if (buyerError) throw buyerError;
          setBuyerUsername(buyerData.username);

          // Fetch seller's username
          const { data: sellerData, error: sellerError } = await client
            .from('Users')
            .select('username')
            .eq('id', orderData.seller)
            .single();

          if (sellerError) throw sellerError;
          setSellerUsername(sellerData.username);

          // Fetch post details if post exists
          if (orderData.post) {
            const { data: postData, error: postError } = await client
              .from('post')
              .select('*')
              .eq('id', orderData.post.id)
              .single();

            if (postError) throw postError;
            setPost(postData);
          }
        }
      } catch (error) {
        setError('Failed to load issue details');
        console.error('Error fetching issue details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchIssueDetails();
  }, [id]);

  const handleAddResponse = async () => {
    if (!newResponse.trim()) return;

    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;

      const newResponseObj = {
        username: user.user_metadata?.username || 'Unknown',
        message: newResponse,
        timestamp: new Date().toISOString()
      };

      const updatedResponses = [...(issue?.response || []), newResponseObj];

      // Update issue status to "under-review" if it's the first response
      const newStatus = issue?.response?.length === 0 ? 'under-review' : issue?.status || '';

      const { error } = await client
        .from('issues')
        .update({ response: JSON.stringify(updatedResponses), status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setIssue(prev => prev ? { ...prev, response: updatedResponses, status: newStatus as string } : null);
      setNewResponse('');
    } catch (error) {
      console.error('Error adding response:', error);
    }
  };

  const handleResolveIssue = async () => {
    try {
      const { error } = await client
        .from('issues')
        .update({ status: 'resolved' })
        .eq('id', id);

      if (error) throw error;

      setIssue(prev => prev ? { ...prev, status: 'resolved' } : null);
    } catch (error) {
      console.error('Error resolving issue:', error);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;
  if (!issue) return <div>Issue not found</div>;
  if (!authorized) {
    return null;
  }

  const shippingAddress = order ? JSON.parse(order?.shipping_address) : null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'initiated':
        return 'bg-red-500';
      case 'under-review':
        return 'bg-yellow-500';
      case 'resolved':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="max-w-7xl mt-16 mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-8">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle>Issue Details</CardTitle>
              <span className={`text-white px-1 py-1 rounded ${getStatusColor(issue.status)}`}>
                {issue.status}
              </span>
            </CardHeader>
            <CardContent>
              <p><strong>Reported by:</strong> {issue.issuer.username}</p>
              <p><strong>Reported on:</strong> {new Date(issue.created_at).toLocaleDateString()}</p>
              <p><strong>Comments:</strong> {issue.comments}</p>
              <Collapsible>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 rounded-lg">
                  <span className="text-sm">View Responses</span>
                  <ChevronRight className="w-4 h-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="p-2 space-y-4">
                  {issue.response && issue.response.length > 0 && (
                    <div className="mt-4">
                      {issue.response.map((response, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-lg mt-2">
                          <div className="flex justify-between items-start">
                            <span className="text-sm font-medium">{response.username}</span>
                            <span className="text-xs text-gray-500">
                              {new Date(response.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm mt-1">{response.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
              <div className="mt-4">
                <Input
                  placeholder="Add a response..."
                  value={newResponse}
                  onChange={(e) => setNewResponse(e.target.value)}
                />
                </div>
                <div className='flex flex-row mt-2 items-center justify-between'>
                <Button className="" onClick={handleAddResponse}>
                  Submit Response
                </Button>
              {(currentUser?.id === issue?.issuer?.id || buyerUsername === sellerUsername) && issue.status !== 'resolved' && (
                <Button className=" bg-green-500" onClick={handleResolveIssue}>
                  Resolve Issue
                </Button>
              )}
              </div>
            </CardContent>
          </Card>

          {order && (
            <Card>
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
              </CardHeader>
              <CardContent>
                <p><strong>Order Date:</strong> {new Date(order.created_at).toLocaleDateString()}</p>
                <p><strong>Buyer:</strong> {buyerUsername}</p>
                <p><strong>Seller:</strong> {sellerUsername}</p>
                <p><strong>Shipping Address:</strong></p>
                <p>{shippingAddress.streetAddress}</p>
                <p>{shippingAddress.city}, {shippingAddress.state} {shippingAddress.zipCode}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {post && (
          <div className="flex-1">
            <Card>
              <CardHeader>
                <CardTitle>Post Details</CardTitle>
              </CardHeader>
              <CardContent>
                <p><strong>Post Title:</strong> {post.title}</p>
                <p><strong>Description:</strong> {post.description}</p>
                <p><strong>Current Bid:</strong> ${(post.current_bid / 100).toFixed(2)}</p>
                <div className="mt-4">
                  <img
                    src={JSON.parse(post.pictures)[0]}
                    alt={post.title}
                    className="w-full h-auto rounded-lg object-cover"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Button className="mt-8" onClick={() => router.back()}>
        Back to Issues
      </Button>
    </div>
  );
};

export default IssuePage;