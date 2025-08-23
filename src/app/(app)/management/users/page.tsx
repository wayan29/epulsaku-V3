// src/app/(app)/management/users/page.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { type StoredUser, createUser, getAllUsers, deleteUser, updateUser, toggleUserStatus } from '@/lib/user-utils';
import { ALL_APP_MENUS, type AppMenu } from '@/lib/auth-utils';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, UserPlus, ShieldAlert, UserCog, Lock, KeyRound, Mail, UserCircle2, Trash2, Edit, AlertTriangle, Send, Power, PowerOff, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  DialogTrigger,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import ProtectedRoute from '@/components/core/ProtectedRoute';


const roleOptions: ('staf' | 'admin')[] = ['staf', 'admin'];

const menuKeys = ALL_APP_MENUS.map(menu => menu.key);

const baseUserFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal('')),
  pin: z.string().length(6, "PIN must be 6 digits").regex(/^\d+$/, "PIN must be only digits").optional().or(z.literal('')),
  role: z.enum(roleOptions, { required_error: "Role is required" }),
  telegramChatId: z.string().regex(/^\-?\d*$/, "Must be a valid numeric Chat ID").optional().or(z.literal('')),
  permissions: z.array(z.string()).optional().default([]),
});

const addUserFormSchema = baseUserFormSchema.extend({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    adminPasswordConfirmation: z.string().min(1, "Your password is required to create a user"),
});

type AddUserFormValues = z.infer<typeof addUserFormSchema>;

const editUserFormSchema = baseUserFormSchema.omit({ username: true });

type EditUserFormValues = z.infer<typeof editUserFormSchema>;

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [userToDelete, setUserToDelete] = useState<StoredUser | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [userToEdit, setUserToEdit] = useState<StoredUser | null>(null);

  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [userToToggle, setUserToToggle] = useState<StoredUser | null>(null);

  const addUserForm = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserFormSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      pin: '',
      role: 'staf',
      telegramChatId: '',
      permissions: [],
      adminPasswordConfirmation: '',
    },
  });

  const editUserForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: { email: '', role: 'staf', password: '', pin: '', telegramChatId: '', permissions: [] },
  });
  
  const fetchUsers = useCallback(async () => {
      setIsLoadingUsers(true);
      try {
          const allUsers = await getAllUsers();
          setUsers(allUsers);
      } catch (error) {
          toast({ title: "Error", description: "Could not load user list.", variant: "destructive" });
      } finally {
          setIsLoadingUsers(false);
      }
  },[toast]);

  useEffect(() => {
    if (currentUser?.role === 'super_admin') {
      fetchUsers();
    }
  }, [currentUser, router, toast, fetchUsers]);

  async function onAddUserSubmit(values: AddUserFormValues) {
    if (!currentUser || currentUser.role !== 'super_admin') {
      toast({ title: "Unauthorized", description: "You are not authorized to perform this action.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createUser({
        username: values.username,
        email: values.email,
        passwordPlain: values.password,
        pinPlain: values.pin,
        role: values.role,
        permissions: values.permissions,
        creatorId: currentUser.id,
        telegramChatId: values.telegramChatId,
        adminPasswordConfirmation: values.adminPasswordConfirmation,
      });

      if (result.success) {
        toast({ title: "User Created", description: `User '${values.username}' was successfully created.` });
        addUserForm.reset();
        fetchUsers();
      } else {
        toast({ title: "Creation Failed", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onEditUserSubmit(values: EditUserFormValues) {
      if (!userToEdit || !currentUser || currentUser.role !== 'super_admin') return;

      setIsSubmitting(true);
      try {
          const result = await updateUser({
              userId: userToEdit._id,
              updates: {
                  email: values.email,
                  role: values.role,
                  permissions: values.permissions,
                  newPassword: values.password,
                  newPin: values.pin,
                  telegramChatId: values.telegramChatId,
              },
              editorId: currentUser.id
          });

          if (result.success) {
              toast({ title: "User Updated", description: `User '${userToEdit.username}' updated successfully.` });
              setIsEditing(false);
              setUserToEdit(null);
              fetchUsers();
          } else {
              toast({ title: "Update Failed", description: result.message, variant: "destructive" });
          }
      } catch (error) {
           const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
           toast({ title: "Error", description: errorMessage, variant: "destructive" });
      } finally {
          setIsSubmitting(false);
      }
  }

  const handleToggleStatusClick = (user: StoredUser) => {
    setUserToToggle(user);
  };
  
  const handleConfirmToggleStatus = async () => {
    if (!userToToggle || !currentUser || currentUser.role !== 'super_admin') {
        toast({ title: "Error", description: "Cannot perform this action.", variant: "destructive" });
        return;
    }

    setIsTogglingStatus(true);
    const result = await toggleUserStatus(userToToggle._id, currentUser.id);

    if (result.success) {
        toast({ title: "User Status Changed", description: `User '${userToToggle.username}' has been ${userToToggle.isDisabled ? 'enabled' : 'disabled'}.` });
        fetchUsers();
    } else {
        toast({ title: "Action Failed", description: result.message, variant: "destructive" });
    }
    
    setIsTogglingStatus(false);
    setUserToToggle(null);
  };


  const handleDeleteClick = (user: StoredUser) => {
    setUserToDelete(user);
  };
  
  const handleEditClick = (user: StoredUser) => {
      setUserToEdit(user);
      editUserForm.reset({
          email: user.email || '',
          role: user.role as 'staf' | 'admin',
          password: '',
          pin: '',
          telegramChatId: user.telegramChatId || '',
          permissions: user.permissions || [],
      });
      setIsEditing(true);
  }

  const handleConfirmDelete = async () => {
    if (!userToDelete || !currentUser || currentUser.role !== 'super_admin') {
      toast({ title: "Error", description: "Cannot perform delete action.", variant: "destructive" });
      return;
    }

    setIsDeleting(true);
    const result = await deleteUser(userToDelete._id, currentUser.id);

    if (result.success) {
      toast({ title: "User Deleted", description: `User '${userToDelete.username}' has been deleted.` });
      fetchUsers();
    } else {
      toast({ title: "Deletion Failed", description: result.message, variant: "destructive" });
    }
    setIsDeleting(false);
    setUserToDelete(null);
  };

  const renderPermissionsSelector = (formInstance: any) => (
     <div className="col-span-1 md:col-span-2 space-y-3">
        <FormLabel className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4"/>Menu Permissions</FormLabel>
        <Controller
            name="permissions"
            control={formInstance.control}
            render={({ field }) => (
                <>
                <div className="flex items-center space-x-2 p-2 rounded-md bg-muted/50 border">
                    <Checkbox
                        id="select-all"
                        onCheckedChange={(checked) => field.onChange(checked ? menuKeys : [])}
                        checked={field.value?.length === menuKeys.length}
                    />
                    <Label htmlFor="select-all" className="font-semibold text-sm">Select All Menus</Label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2 border rounded-md">
                    {ALL_APP_MENUS.filter(menu => menu.key !== 'manajemen_pengguna').map((menu) => (
                    <FormItem key={menu.key} className="flex flex-row items-start space-x-3 space-y-0 p-3 rounded-lg hover:bg-accent/50">
                        <FormControl>
                        <Checkbox
                            checked={field.value?.includes(menu.key)}
                            onCheckedChange={(checked) => {
                            return checked
                                ? field.onChange([...(field.value || []), menu.key])
                                : field.onChange((field.value || []).filter((value:string) => value !== menu.key));
                            }}
                        />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel className="font-medium cursor-pointer">{menu.label}</FormLabel>
                            <p className="text-xs text-muted-foreground">{menu.description}</p>
                        </div>
                    </FormItem>
                    ))}
                </div>
                </>
            )}
        />
     </div>
  );


  return (
    <ProtectedRoute requiredPermission='manajemen_pengguna'>
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-2">
        <UserCog className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-headline">User Management</h1>
          <p className="text-muted-foreground">Add, edit, or remove 'admin' or 'staf' users and manage their permissions.</p>
        </div>
      </div>

      <Dialog>
        <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 h-4 w-4"/> Add New User</Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new account and set their permissions. PIN and Telegram Chat ID are optional.</DialogDescription>
            </DialogHeader>
            <Form {...addUserForm}>
            <form onSubmit={addUserForm.handleSubmit(onAddUserSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={addUserForm.control} name="username" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><UserCircle2 className="mr-2 h-4 w-4 text-muted-foreground"/>Username</FormLabel><FormControl><Input placeholder="e.g., jane.doe" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={addUserForm.control} name="email" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground"/>Email (Optional)</FormLabel><FormControl><Input placeholder="user@example.com" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={addUserForm.control} name="password" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4 text-muted-foreground"/>Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={addUserForm.control} name="pin" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground"/>6-Digit PIN (Optional)</FormLabel><FormControl><Input type="password" placeholder="●●●●●●" {...field} maxLength={6} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={addUserForm.control} name="role" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><ShieldAlert className="mr-2 h-4 w-4 text-muted-foreground"/>Role</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}><FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl><SelectContent>{roleOptions.map(role => (<SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={addUserForm.control} name="telegramChatId" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><Send className="mr-2 h-4 w-4 text-muted-foreground"/>Telegram Chat ID (Optional)</FormLabel><FormControl><Input placeholder="e.g., 123456789" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                {renderPermissionsSelector(addUserForm)}
                 <div className="col-span-1 md:col-span-2 pt-4 border-t">
                    <FormField
                    control={addUserForm.control}
                    name="adminPasswordConfirmation"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="flex items-center text-md font-semibold text-destructive"><Lock className="mr-2 h-5 w-5 text-destructive" />Confirm with Your Password</FormLabel>
                        <FormControl>
                            <Input type="password" placeholder="Enter your super admin password" {...field} disabled={isSubmitting} className="border-destructive focus:border-destructive" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserPlus className="mr-2 h-4 w-4"/>}Create User</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <Card>
        <CardHeader>
          <CardTitle>Existing Users</CardTitle>
          <CardDescription>List of all users in the system.</CardDescription>
        </CardHeader>
        <CardContent>
           {isLoadingUsers ? (
             <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>
           ) : (
            <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Telegram Chat ID</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map((user) => (
                    <TableRow key={user._id}>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell>{user.email || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'super_admin' ? 'destructive' : user.role === 'admin' ? 'secondary' : 'default'} className="capitalize">{user.role.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isDisabled ? 'destructive' : 'default'} className={user.isDisabled ? 'bg-red-100 text-red-800 border-red-300' : 'bg-green-100 text-green-800 border-green-300'}>
                              {user.isDisabled ? 'Disabled' : 'Active'}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.telegramChatId || 'N/A'}</TableCell>
                        <TableCell>{user.createdBy || 'N/A'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                             <Button variant="ghost" size="icon" onClick={() => handleToggleStatusClick(user)} disabled={user.role === 'super_admin'} title={user.isDisabled ? 'Enable User' : 'Disable User'}>
                                {user.isDisabled ? <Power className="h-4 w-4 text-green-600"/> : <PowerOff className="h-4 w-4 text-yellow-600" />}
                             </Button>
                             <Button variant="ghost" size="icon" onClick={() => handleEditClick(user)} disabled={user.role === 'super_admin'}>
                              <Edit className="h-4 w-4"/>
                            </Button>
                             <AlertDialog onOpenChange={(open) => { if (!open) setUserToDelete(null); }}>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(user)} disabled={user.role === 'super_admin'}>
                                        <Trash2 className="h-4 w-4 text-destructive"/>
                                    </Button>
                                </AlertDialogTrigger>
                                {userToDelete && userToDelete._id === user._id && (
                                    <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-6 w-6 text-destructive" />Confirm Deletion</AlertDialogTitle>
                                        <AlertDialogDescription>Are you sure you want to delete user '{userToDelete?.username}'? This action cannot be undone.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                        <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
                                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Delete User
                                        </Button>
                                    </AlertDialogFooter>
                                    </AlertDialogContent>
                                )}
                             </AlertDialog>
                          </div>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>
           )}
        </CardContent>
      </Card>
      
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Edit User: {userToEdit?.username}</DialogTitle>
                <DialogDescription>Update user details and permissions. Leave password or PIN fields blank to keep them unchanged.</DialogDescription>
            </DialogHeader>
            <Form {...editUserForm}>
                <form onSubmit={editUserForm.handleSubmit(onEditUserSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={editUserForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={editUserForm.control} name="role" render={({ field }) => (<FormItem><FormLabel>Role</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{roleOptions.map(role => (<SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
                        <FormField control={editUserForm.control} name="telegramChatId" render={({ field }) => (<FormItem><FormLabel>Telegram Chat ID (Optional)</FormLabel><FormControl><Input {...field} placeholder="e.g. 123456789" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={editUserForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>New Password (Optional)</FormLabel><FormControl><Input type="password" {...field} placeholder="Leave blank to keep current password" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={editUserForm.control} name="pin" render={({ field }) => (<FormItem><FormLabel>New PIN (Optional)</FormLabel><FormControl><Input type="password" {...field} placeholder="Leave blank to keep current PIN" maxLength={6} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)}/>
                        {renderPermissionsSelector(editUserForm)}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save Changes</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!userToToggle} onOpenChange={(open) => { if(!open) setUserToToggle(null)}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-6 w-6 text-yellow-500" />Confirm Status Change</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to {userToToggle?.isDisabled ? 'enable' : 'disable'} the user '{userToToggle?.username}'? {userToToggle && !userToToggle.isDisabled && " They will be logged out and unable to log in."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isTogglingStatus}>Cancel</AlertDialogCancel>
            <Button variant={userToToggle?.isDisabled ? 'default' : 'destructive'} onClick={handleConfirmToggleStatus} disabled={isTogglingStatus}>{isTogglingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{userToToggle?.isDisabled ? 'Enable' : 'Disable'} User</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
    </ProtectedRoute>
  );
}
