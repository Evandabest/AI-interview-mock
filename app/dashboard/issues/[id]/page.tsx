"use client"
import { createClient } from '@/lib/local/client';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const client = createClient();

// Add interface for Response type
interface Response {
  timestamp: string;
  message: string;
  username: string;
}

export default function IssuePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [issue, setIssue] = useState<any>(null);
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [buyerFormData, setBuyerFormData] = useState({
    type: issue?.order?.buyer?.type || 'visitor',
    bad_review: issue?.order?.buyer?.bad_review || 0,
    suspended: issue?.order?.buyer?.suspended || false,
    warning: issue?.order?.buyer?.warning || false,
    suspended_times: issue?.order?.buyer?.suspended_times || 0
  });

  const [sellerFormData, setSellerFormData] = useState({
    type: issue?.order?.seller?.type || 'visitor',
    bad_review: issue?.order?.seller?.bad_review || 0,
    suspended: issue?.order?.seller?.suspended || false,
    warning: issue?.order?.seller?.warning || false,
    suspended_times: issue?.order?.seller?.suspended_times || 0
  });

  // Add state for authorization
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

      if (userError || userData?.type !== 'super-user') {
        router.push('/home');
        return;
      }

      setAuthorized(true);
    };

    checkAuthorization();
  }, []);

  useEffect(() => {
    fetchIssueData();
  }, []);

  // First update fetchIssueData to include more post details
  async function fetchIssueData() {
    // First get the issue with basic user info
    const { data: issueData, error: issueError } = await client
      .from('issues')
      .select(`
        *,
        issuer:Users!issues_issuer_fkey(*),
        issuee:Users!issues_issuee_fkey(*),
        order:orders(
          *,
          post(
            id,
            title,
            description,
            created_at,
            expire,
            current_bid,
            starting_bid,
            pictures,
            status
          ),
          buyer:Users!orders_buyer_fkey(*),
          seller:Users!orders_seller_fkey(*)
        )
      `)
      .eq('id', params.id)
      .single();

    if (issueError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch issue data",
      });
      return;
    }

    // If there's no order, set the issue data with issuer/issuee as the primary users
    if (!issueData.order) {
      setIssue({
        ...issueData,
        issuer: issueData.issuer,
        issuee: issueData.issuee,
      });
    } else {
      // If there is an order, keep the existing structure
      setIssue(issueData);
    }

    setLoading(false);
  }

  // Modify handleAddResponse function
  async function handleAddResponse(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const currentResponses = (typeof issue.response === 'string' ? JSON.parse(issue.response || '[]') : (issue.response || []));
    const newResponse = {
      timestamp: new Date().toISOString(),
      message: response,
      username: '[Moderator]'
    };

    const { error } = await client
      .from('issues')
      .update({
        response: JSON.stringify([...currentResponses, newResponse]),
        status: 'under-review'
      })
      .eq('id', params.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add response",
      });
    } else {
      toast({
        title: "Success",
        description: "Response added successfully",
      });
      setResponse('');
      fetchIssueData();
    }

    setSubmitting(false);
  }

  // Modify handleRefund function
  async function handleRefund() {
    if (!issue.order) return;

    setSubmitting(true);
    const order = issue.order;
    const bidAmount = order.post.current_bid;
    
    // Buyer refund calculation
    const tax = Math.floor(bidAmount * 0.08875);
    const serviceFee = Math.floor(bidAmount * 0.05);
    const totalRefund = bidAmount + tax + serviceFee;

    // Seller deduction calculation (90% of bid + 5% service fee)
    const sellerAmount = Math.floor(bidAmount * 0.9);
    const sellerServiceFee = Math.floor(sellerAmount * 0.05);
    const totalSellerDeduction = sellerAmount + sellerServiceFee;

    // Get buyer's current balance
    const { data: buyerData, error: buyerBalanceError } = await client
      .from('Users')
      .select('balance')
      .eq('id', order.buyer)
      .single();

    if (buyerBalanceError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch buyer data",
      });
      setSubmitting(false);
      return;
    }

    // Get seller's current balance
    const { data: sellerData, error: sellerBalanceError } = await client
      .from('Users')
      .select('balance')
      .eq('id', order.seller)
      .single();

    if (sellerBalanceError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch seller data",
      });
      setSubmitting(false);
      return;
    }

    // Update buyer's balance
    const { error: buyerError } = await client
      .from('Users')
      .update({
        balance: (buyerData.balance || 0) + totalRefund
      })
      .eq('id', order.buyer);

    if (buyerError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to process refund",
      });
      setSubmitting(false);
      return;
    }

    // Update seller's balance
    const { error: sellerError } = await client
      .from('Users')
      .update({
        balance: (sellerData.balance || 0) - totalSellerDeduction
      })
      .eq('id', order.seller);

    if (sellerError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to process seller deduction",
      });
      setSubmitting(false);
      return;
    }

    // Update issue status
    const { error: issueError } = await client
      .from('issues')
      .update({
        status: 'resolved'
      })
      .eq('id', params.id);

    if (issueError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update issue status",
      });
    } else {
      toast({
        title: "Success",
        description: "Refund processed successfully",
      });
      fetchIssueData();
    }

    setSubmitting(false);
  }

  // Add this function in the component
  async function handleUserUpdate(userId: string, updates: any) {
    setSubmitting(true);

    const { error } = await client
      .from('Users')
      .update(updates)
      .eq('id', userId);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update user",
      });
    } else {
      toast({
        title: "Success",
        description: "User updated successfully",
      });
      fetchIssueData();
    }

    setSubmitting(false);
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  // Update return statement to include auth check
  if (!authorized) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Issue Details</h1>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard')}
        >
          Back to Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Issue Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-medium">Status</p>
              <div className={`px-2 py-1 rounded-full text-xs font-medium text-white inline-block
                ${issue.status === 'initiated' ? 'bg-red-500' : 
                  issue.status === 'under-review' ? 'bg-yellow-500' : 
                  issue.status === 'resolved' ? 'bg-green-500' : 'bg-gray-500'}`}>
                {issue.status}
              </div>
            </div>
            <div>
              <p className="font-medium">Created At</p>
              <p>{new Date(issue.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="font-medium">Issuer</p>
              <p>{issue.issuer.username}</p>
            </div>
            <div>
              <p className="font-medium">Issuee</p>
              <p>{issue.issuee.username}</p>
            </div>
          </div>

          <div>
            <p className="font-medium">Comments</p>
            <p className="whitespace-pre-wrap">{issue.comments}</p>
          </div>

          {issue.order && (
            <div className="border-t pt-4">
              <p className="font-medium mb-2">Associated Order</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-medium">Order ID</p>
                  <p className="text-sm">{issue.order.id}</p>
                </div>
                <div>
                  <p className="font-medium">Bid Amount</p>
                  <p className="text-sm">{(issue.order.post.current_bid / 100).toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD'
                  })}</p>
                </div>
              </div>

              {issue.status !== 'resolved' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive"
                      className="mt-4"
                      disabled={submitting}
                    >
                      Process Refund
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will refund the full amount including tax and service fee to the buyer.
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleRefund}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}

          {issue.order?.post && (
            <div className="border-t pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Post Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Left column - Post details */}
                    <div className="space-y-4">
                      <div>
                        <p className="font-medium">Title</p>
                        <p>{issue.order.post.title}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="font-medium">Status</p>
                          <div className={`px-2 py-1 rounded-full text-xs font-medium text-white inline-block
                            ${issue.order.post.status === 'active' ? 'bg-green-500' : 
                              issue.order.post.status === 'expired' ? 'bg-red-500' : 
                              'bg-gray-500'}`}>
                            {issue.order.post.status}
                          </div>
                        </div>
                        <div>
                          <p className="font-medium">Current Bid</p>
                          <p>{(issue.order.post.current_bid / 100).toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD'
                          })}</p>
                        </div>
                        <div>
                          <p className="font-medium">Posted On</p>
                          <p>{new Date(issue.order.post.created_at).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="font-medium">Expires On</p>
                          <p>{new Date(issue.order.post.expire).toLocaleDateString()}</p>
                        </div>
                      </div>

                      <div>
                        <p className="font-medium mb-2">Description</p>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">
                          {issue.order.post.description}
                        </p>
                      </div>
                    </div>

                    {/* Right column - Preview image */}
                    {JSON.parse(issue.order.post.pictures)[0] && (
                      <div>
                        <p className="font-medium mb-2">Preview Image</p>
                        <img 
                          src={JSON.parse(issue.order.post.pictures)[0]} 
                          alt="Post preview"
                          className="w-full h-48 object-cover rounded-lg shadow-sm"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6 border-t pt-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    {issue.order ? 'Buyer' : 'Issuer'} Information
                  </CardTitle>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">Edit</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        handleUserUpdate(
                          issue.order ? issue.order.buyer.id : issue.issuer.id, 
                          buyerFormData
                        );
                      }}>
                        <DialogHeader>
                          <DialogTitle>Edit {issue.order ? 'Buyer' : 'Issuer'} Details</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Account Type</Label>
                            <Select
                              defaultValue={issue.order ? issue.order.buyer.type : issue.issuer.type}
                              onValueChange={(value) => setBuyerFormData(prev => ({...prev, type: value}))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="visitor">Visitor</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Bad Reviews</Label>
                            <Input 
                              type="number"
                              min="0"
                              defaultValue={issue.order ? issue.order.buyer.bad_review : issue.issuer.bad_review}
                              onChange={(e) => setBuyerFormData(prev => ({
                                ...prev, 
                                bad_review: parseInt(e.target.value)
                              }))}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label>Suspended</Label>
                            <Switch
                              checked={buyerFormData.suspended}
                              onCheckedChange={(checked) => setBuyerFormData(prev => ({
                                ...prev,
                                suspended: checked
                              }))}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label>Warning</Label>
                            <Switch
                              checked={buyerFormData.warning}
                              onCheckedChange={(checked) => setBuyerFormData(prev => ({
                                ...prev,
                                warning: checked
                              }))}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Suspension Times</Label>
                            <Input 
                              type="number"
                              min="0"
                              defaultValue={issue.order ? issue.order.buyer.suspended_times : issue.issuer.suspended_times}
                              onChange={(e) => setBuyerFormData(prev => ({
                                ...prev,
                                suspended_times: parseInt(e.target.value)
                              }))}
                            />
                          </div>

                          <Button type="submit" className="w-full" disabled={submitting}>
                            Save Changes
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Username</p>
                    <p>{issue.order ? issue.order.buyer.username : issue.issuer.username}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Email</p>
                    <p>{issue.order ? issue.order.buyer.email : issue.issuer.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Rating</p>
                    <p>{(issue.order ? issue.order.buyer.rating : issue.issuer.rating).toFixed(1)} / 5.0</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Balance</p>
                    <p>{((issue.order ? issue.order.buyer.balance : issue.issuer.balance) / 100).toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD'
                    })}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Account Type</p>
                    <p className="capitalize">{issue.order ? issue.order.buyer.type : issue.issuer.type}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Bad Reviews</p>
                    <p>{issue.order ? issue.order.buyer.bad_review : issue.issuer.bad_review}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Suspensions</p>
                    <p>{issue.order ? issue.order.buyer.suspended_times : issue.issuer.suspended_times}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  {(issue.order ? issue.order.buyer.suspended : issue.issuer.suspended) && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600">
                      Suspended
                    </span>
                  )}
                  {(issue.order ? issue.order.buyer.warning : issue.issuer.warning) && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-600">
                      Warning
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {((issue.order && issue.order.buyer.id !== issue.order.seller.id) || 
              (!issue.order && issue.issuer.id !== issue.issuee.id)) && (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                      {issue.order ? 'Seller' : 'Issuee'} Information
                    </CardTitle>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">Edit</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          handleUserUpdate(
                            issue.order ? issue.order.seller.id : issue.issuee.id, 
                            sellerFormData
                          );
                        }}>
                          <DialogHeader>
                            <DialogTitle>Edit {issue.order ? 'Seller' : 'Issuee'} Details</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Account Type</Label>
                              <Select
                                defaultValue={issue.order ? issue.order.seller.type : issue.issuee.type}
                                onValueChange={(value) => setSellerFormData(prev => ({...prev, type: value}))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="visitor">Visitor</SelectItem>
                                  <SelectItem value="user">User</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Bad Reviews</Label>
                              <Input 
                                type="number"
                                min="0"
                                defaultValue={issue.order ? issue.order.seller.bad_review : issue.issuee.bad_review}
                                onChange={(e) => setSellerFormData(prev => ({
                                  ...prev, 
                                  bad_review: parseInt(e.target.value)
                                }))}
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <Label>Suspended</Label>
                              <Switch
                                checked={sellerFormData.suspended}
                                onCheckedChange={(checked) => setSellerFormData(prev => ({
                                  ...prev,
                                  suspended: checked
                                }))}
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <Label>Warning</Label>
                              <Switch
                                checked={sellerFormData.warning}
                                onCheckedChange={(checked) => setSellerFormData(prev => ({
                                  ...prev,
                                  warning: checked
                                }))}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Suspension Times</Label>
                              <Input 
                                type="number"
                                min="0"
                                defaultValue={issue.order ? issue.order.seller.suspended_times : issue.issuee.suspended_times}
                                onChange={(e) => setSellerFormData(prev => ({
                                  ...prev,
                                  suspended_times: parseInt(e.target.value)
                                }))}
                              />
                            </div>

                            <Button type="submit" className="w-full" disabled={submitting}>
                              Save Changes
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Username</p>
                      <p>{issue.order ? issue.order.seller.username : issue.issuee.username}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Email</p>
                      <p>{issue.order ? issue.order.seller.email : issue.issuee.email}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Rating</p>
                      <p>{(issue.order ? issue.order.seller.rating : issue.issuee.rating).toFixed(1)} / 5.0</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Balance</p>
                      <p>{((issue.order ? issue.order.seller.balance : issue.issuee.balance) / 100).toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'USD'
                      })}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Account Type</p>
                      <p className="capitalize">{issue.order ? issue.order.seller.type : issue.issuee.type}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Bad Reviews</p>
                      <p>{issue.order ? issue.order.seller.bad_review : issue.issuee.bad_review}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Suspensions</p>
                      <p>{issue.order ? issue.order.seller.suspended_times : issue.issuee.suspended_times}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {(issue.order ? issue.order.seller.suspended : issue.issuee.suspended) && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600">
                        Suspended
                      </span>
                    )}
                    {(issue.order ? issue.order.seller.warning : issue.issuee.warning) && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-600">
                        Warning
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="border-t pt-4">
            <p className="font-medium mb-2">Responses</p>
            <div className="space-y-2">
              {(typeof issue.response === 'string' ? JSON.parse(issue.response || '[]') : (issue.response || [])).map((response: Response, index: number) => (
                <div key={index} className="bg-gray-50 p-3 rounded">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-medium text-blue-600">{response.username}</p>
                    <p className="text-sm text-gray-500">{new Date(response.timestamp).toLocaleString()}</p>
                  </div>
                  <p className="whitespace-pre-wrap">{response.message}</p>
                </div>
              ))}
            </div>
          </div>

          {issue.status !== 'resolved' && (
            <form onSubmit={handleAddResponse} className="border-t pt-4">
              <p className="font-medium mb-2">Add Response</p>
              <Textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Type your response here..."
                className="min-h-[100px]"
                required
              />
              <Button 
                type="submit"
                className="mt-2"
                disabled={submitting}
              >
                Submit Response
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}