"use client"
import { createClient } from '@/lib/local/client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Users, AlertCircle, DollarSign } from "lucide-react";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";

const client = createClient();

function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [stats, setStats] = useState({
    todayBids: 0,
    highestBid: 0,
    activePosts: 0
  });
  const [applications, setApplications] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);

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
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch today's bids
    const { data: todayBids } = await client
      .from('bids')
      .select('count')
      .gte('created_at', today.toISOString());

    // Fetch highest bid
    const { data: highestBid } = await client
      .from('bids')
      .select('bid_amount')
      .order('bid_amount', { ascending: false })
      .limit(1);

    // Fetch active posts
    const { data: activePosts } = await client
      .from('post')
      .select('count')
      .eq('status', 'active');

    // Fetch applications
    const { data: applicationData } = await client
      .from('application')
      .select('*, Users(username)')
      .order('created_at', { ascending: false });

    // Fetch issues
    const { data: issueData } = await client
      .from('issues')
      .select(`
        *,
        issuer_user:Users!issues_issuer_fkey(username),
        issuee_user:Users!issues_issuee_fkey(username)
      `)
      .order('created_at', { ascending: false });

    setStats({
      todayBids: todayBids?.[0]?.count || 0,
      highestBid: highestBid?.[0]?.bid_amount || 0,
      activePosts: activePosts?.[0]?.count || 0
    });
    setApplications(applicationData || []);
    setIssues(issueData || []);
    setLoading(false);
  }

  const formatMoney = (cents: number) => {
    return (cents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD'
    });
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!authorized) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Bids</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayBids}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Highest Bid</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(stats.highestBid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Posts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activePosts}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="applications">
        <TabsList>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
        </TabsList>
        
        <TabsContent value="applications">
          <Card>
            <CardHeader>
              <CardTitle>User Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>{app.Users?.username}</TableCell>
                      <TableCell>{app.email}</TableCell>
                      <TableCell>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium text-white inline-block
                          ${app.status === 'initiated' ? 'bg-red-500' : 
                            app.status === 'under-review' ? 'bg-yellow-500' : 
                            app.status === 'resolved' ? 'bg-green-500' : 'bg-gray-500'}`}>
                          {app.status}
                        </div>
                      </TableCell>
                      <TableCell>{new Date(app.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/applications/${app.id}`)}
                        >
                          More Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues">
          <Card>
            <CardHeader>
              <CardTitle>Current Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issuer</TableHead>
                    <TableHead>Issuee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell>{issue.issuer_user?.username}</TableCell>
                      <TableCell>{issue.issuee_user?.username}</TableCell>
                      <TableCell>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium text-white inline-block
                          ${issue.status === 'initiated' ? 'bg-red-500' : 
                            issue.status === 'under-review' ? 'bg-yellow-500' : 
                            issue.status === 'resolved' ? 'bg-green-500' : 'bg-gray-500'}`}>
                          {issue.status}
                        </div>
                      </TableCell>
                      <TableCell>{new Date(issue.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/issues/${issue.id}`)}
                        >
                          More Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default DashboardPage;