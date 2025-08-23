// src/lib/user-utils.ts
'use server';

import { readDb, writeDb } from './mongodb';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { StoredUser, User, UserRole, LoginActivity, UserUpdatePayload } from './auth-utils';
import { JWT_SECRET, SALT_ROUNDS } from './auth-utils';
import { subDays } from 'date-fns';
import { trySendTelegramNotification } from './notification-utils';

// --- Login Activity Pruning ---
async function pruneOldLoginActivity(): Promise<void> {
  try {
    const allActivities = await readDb<LoginActivity[]>("login_activity");
    if (allActivities.length === 0) return;

    const sixtyDaysAgo = subDays(new Date(), 60);
    
    const recentActivities = allActivities.filter(activity => {
      const activityDate = new Date(activity.loginTimestamp);
      return isNaN(activityDate.getTime()) || activityDate >= sixtyDaysAgo;
    });
    
    if (recentActivities.length < allActivities.length) {
      console.log(`[DB Pruning] Deleting ${allActivities.length - recentActivities.length} login activity records older than 60 days.`);
      await writeDb("login_activity", recentActivities);
    }
  } catch (error) {
     console.error("Error pruning old login activity from DB:", error);
  }
}


// This function is now only used internally or by API routes, not directly by client components.
export async function checkIfUsersExist(): Promise<boolean> {
  try {
    const users = await readDb<StoredUser[]>("users");
    return users.length > 0;
  } catch (error) {
    console.error("Error checking if users exist:", error);
    return true; 
  }
}

export async function createUser({
  username,
  email,
  passwordPlain,
  pinPlain,
  role,
  permissions,
  creatorId,
  telegramChatId,
  adminPasswordConfirmation, // New parameter
}: {
  username: string;
  email?: string;
  passwordPlain: string;
  pinPlain?: string;
  role?: UserRole;
  permissions?: string[];
  creatorId?: string;
  telegramChatId?: string;
  adminPasswordConfirmation?: string; // New parameter
}): Promise<{ success: boolean; message: string; user?: User }> {
  try {
    if (!JWT_SECRET) {
      console.error("FATAL: JWT_SECRET environment variable is not set. Cannot create user.");
      return { success: false, message: "Server configuration error: JWT secret is missing." };
    }
    const users = await readDb<StoredUser[]>("users");
    let finalRole: UserRole;

    if (users.length === 0) {
      finalRole = 'super_admin';
    } else {
      const creator = users.find(u => u._id === creatorId);
      if (!creator || creator.role !== 'super_admin') {
         return { success: false, message: "Only a super_admin can create new users." };
      }
      if (!role || (role !== 'admin' && role !== 'staf')) {
        return { success: false, message: "A valid role ('admin' or 'staf') must be assigned by the super_admin." };
      }
      
      // Password verification for super admin
      if (!adminPasswordConfirmation) {
        return { success: false, message: "Your admin password is required to create a new user." };
      }
      if (!creator.hashedPassword) {
        return { success: false, message: "Creator account has no password set." };
      }
      const isPasswordValid = await verifyUserPassword(adminPasswordConfirmation, creator.hashedPassword);
      if (!isPasswordValid) {
        return { success: false, message: "Incorrect admin password. User creation failed." };
      }

      finalRole = role;
    }

    const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existingUser) {
      return { success: false, message: "Username already exists." };
    }

    const hashedPassword = await bcrypt.hash(passwordPlain, SALT_ROUNDS);
    const hashedPin = pinPlain ? await bcrypt.hash(pinPlain, SALT_ROUNDS) : undefined;
    const userId = crypto.randomUUID();

    const newUser: StoredUser = {
      _id: userId,
      username: username.toLowerCase(),
      email: email?.toLowerCase(),
      hashedPassword: hashedPassword,
      hashedPin: hashedPin,
      role: finalRole,
      permissions: finalRole === 'super_admin' ? ['all_access'] : (permissions || []), // Super admin gets all access
      createdBy: users.length === 0 ? 'system_signup' : creatorId,
      telegramChatId: telegramChatId,
      isDisabled: false,
      failedPinAttempts: 0,
    };

    users.push(newUser);
    await writeDb("users", users);
    
    const userForToken: User = { id: userId, username: newUser.username, role: newUser.role, permissions: newUser.permissions };

    return {
      success: true,
      message: `User ${username} created successfully with role ${finalRole}.`,
      user: userForToken,
    };
  } catch (error) {
    console.error("Error creating user:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, message };
  }
}

export async function recordLoginSuccess(user: StoredUser, userAgent: string | null, ipAddress: string | null): Promise<void> {
    try {
        // Prune old logs before adding a new one. Fire-and-forget.
        pruneOldLoginActivity();

        const loginActivities = await readDb<LoginActivity[]>("login_activity");
        loginActivities.push({
            _id: crypto.randomUUID(),
            userId: user._id,
            username: user.username,
            loginTimestamp: new Date(),
            userAgent: userAgent || 'Unknown UA',
            ipAddress: ipAddress || 'Unknown IP',
        });
        await writeDb("login_activity", loginActivities);
    } catch(e) {
        console.error("Failed to record login activity:", e);
    }
}


export async function deleteUser(userIdToDelete: string, currentAdminId: string): Promise<{ success: boolean; message: string }> {
    try {
        const users = await readDb<StoredUser[]>("users");
        const admin = users.find(u => u._id === currentAdminId);

        if (!admin || admin.role !== 'super_admin') {
            return { success: false, message: "Permission denied. Only a super_admin can delete users." };
        }
        const userToDelete = users.find(u => u._id === userIdToDelete);
        if (!userToDelete) {
            return { success: false, message: "User to delete not found." };
        }
        if (userToDelete.role === 'super_admin') {
            return { success: false, message: "Cannot delete the super_admin account." };
        }

        const updatedUsers = users.filter(u => u._id !== userIdToDelete);
        await writeDb("users", updatedUsers);

        return { success: true, message: `User ${userToDelete.username} deleted successfully.` };
    } catch (error) {
        console.error("Error deleting user:", error);
        return { success: false, message: error instanceof Error ? error.message : "An unknown error occurred." };
    }
}

export async function updateUser({ userId, updates, editorId }: { userId: string, updates: UserUpdatePayload, editorId: string }): Promise<{ success: boolean; message: string }> {
    try {
        const users = await readDb<StoredUser[]>("users");
        const editor = users.find(u => u._id === editorId);
        if (!editor || editor.role !== 'super_admin') {
            return { success: false, message: "Permission denied. Only a super_admin can edit users." };
        }

        const userIndex = users.findIndex(u => u._id === userId);
        if (userIndex === -1) {
            return { success: false, message: "User not found." };
        }
        
        const userToUpdate = users[userIndex];
        if (userToUpdate.role === 'super_admin') {
            return { success: false, message: "Cannot modify the super_admin account via this form." };
        }

        if (updates.email) userToUpdate.email = updates.email;
        if (updates.role && (updates.role === 'admin' || updates.role === 'staf')) userToUpdate.role = updates.role;
        if(updates.permissions) userToUpdate.permissions = updates.permissions;
        if (updates.newPassword) userToUpdate.hashedPassword = await bcrypt.hash(updates.newPassword, SALT_ROUNDS);
        if (updates.newPin) userToUpdate.hashedPin = await bcrypt.hash(updates.newPin, SALT_ROUNDS);
        if (typeof updates.telegramChatId !== 'undefined') userToUpdate.telegramChatId = updates.telegramChatId;
        
        // Reset failed PIN attempts if PIN is changed
        if (updates.newPin) {
            userToUpdate.failedPinAttempts = 0;
        }

        users[userIndex] = userToUpdate;
        await writeDb("users", users);

        return { success: true, message: "User updated successfully." };
    } catch (error) {
        console.error("Error updating user:", error);
        return { success: false, message: error instanceof Error ? error.message : "An unknown error occurred during update." };
    }
}


export async function getUserByUsername(username: string): Promise<StoredUser | null> {
  try {
    const users = await readDb<StoredUser[]>("users");
    return users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
  } catch (error) {
    console.error("Error fetching user by username:", error);
    return null;
  }
}

export async function getAllUsers(): Promise<StoredUser[]> {
    try {
        const users = await readDb<StoredUser[]>("users");
        const creatorUsernameMap = new Map<string, string>();
        users.forEach(user => {
            creatorUsernameMap.set(user._id, user.username);
        });
        return users.map(u => ({
            ...u,
            createdBy: u.createdBy === 'system_signup' ? 'System' : creatorUsernameMap.get(u.createdBy!) || u.createdBy || 'N/A'
        }));
    } catch (error) {
        console.error("Error fetching all users:", error);
        return [];
    }
}

export async function verifyUserPassword(passwordPlain: string, hashedPasswordFromDb: string): Promise<boolean> {
  return bcrypt.compare(passwordPlain, hashedPasswordFromDb);
}

export async function verifyUserPin(pinPlain: string, hashedPinFromDb: string): Promise<boolean> {
  return bcrypt.compare(pinPlain, hashedPinFromDb);
}

export async function getLoginHistory(username: string): Promise<LoginActivity[]> {
  const activities = await readDb<LoginActivity[]>("login_activity");
  return activities
    .filter(a => a.username.toLowerCase() === username.toLowerCase())
    .sort((a, b) => new Date(b.loginTimestamp).getTime() - new Date(a.loginTimestamp).getTime())
    .slice(0, 20);
}

export async function changePassword(username: string, oldPasswordPlain: string, newPasswordPlain: string): Promise<{ success: boolean; message: string }> {
  const users = await readDb<StoredUser[]>("users");
  const userIndex = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
  if (userIndex === -1 || !users[userIndex].hashedPassword) {
    return { success: false, message: "User not found." };
  }
  const user = users[userIndex];
  
  const isOldPasswordValid = await verifyUserPassword(oldPasswordPlain, user.hashedPassword!);
  if (!isOldPasswordValid) {
    return { success: false, message: "Incorrect old password." };
  }
  
  users[userIndex].hashedPassword = await bcrypt.hash(newPasswordPlain, SALT_ROUNDS);
  await writeDb("users", users);

  return { success: true, message: "Password changed successfully. Please log in again." };
}

export async function changePin(username: string, currentPasswordPlain: string, newPinPlain: string): Promise<{ success: boolean; message: string }> {
    const users = await readDb<StoredUser[]>("users");
    const userIndex = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
    if (userIndex === -1 || !users[userIndex].hashedPassword) {
        return { success: false, message: "User not found." };
    }
    const user = users[userIndex];

    const isPasswordValid = await verifyUserPassword(currentPasswordPlain, user.hashedPassword!);
    if (!isPasswordValid) {
        return { success: false, message: "Incorrect account password." };
    }

    users[userIndex].hashedPin = await bcrypt.hash(newPinPlain, SALT_ROUNDS);
    // Reset failed attempts when PIN is successfully changed
    users[userIndex].failedPinAttempts = 0;
    await writeDb("users", users);

    return { success: true, message: "PIN changed successfully." };
}

export async function deleteLoginActivityEntry(activityId: string | null): Promise<{ success: boolean, message?: string }> {
  if (!activityId) {
    return { success: false, message: "Activity ID is required." };
  }
  const activities = await readDb<LoginActivity[]>("login_activity");
  const initialLength = activities.length;
  const updatedActivities = activities.filter(a => a._id !== activityId);
  
  if (updatedActivities.length < initialLength) {
    await writeDb("login_activity", updatedActivities);
    return { success: true, message: "Login activity record deleted." };
  } else {
    return { success: false, message: "Activity record not found." };
  }
}

export async function toggleUserStatus(userIdToToggle: string, adminId: string): Promise<{ success: boolean; message: string }> {
  try {
    const users = await readDb<StoredUser[]>("users");
    const admin = users.find(u => u._id === adminId);

    if (!admin || admin.role !== 'super_admin') {
      return { success: false, message: "Permission denied. Only a super_admin can change user status." };
    }

    const userIndex = users.findIndex(u => u._id === userIdToToggle);
    if (userIndex === -1) {
      return { success: false, message: "User not found." };
    }

    const userToToggle = users[userIndex];
    if (userToToggle.role === 'super_admin') {
      return { success: false, message: "Cannot disable the super_admin account." };
    }

    // Toggle the isDisabled status and reset failed PIN attempts if re-enabling
    const newDisabledStatus = !users[userIndex].isDisabled;
    users[userIndex].isDisabled = newDisabledStatus;
    if (newDisabledStatus === false) { // If user is being enabled
        users[userIndex].failedPinAttempts = 0;
    }

    await writeDb("users", users);
    
    // Send Telegram notification
    trySendTelegramNotification({
        provider: 'System',
        productName: 'Account Security Alert',
        status: `Account ${newDisabledStatus ? 'Disabled' : 'Enabled'}`,
        failureReason: `Status changed by super_admin: ${admin.username}`,
        transactedBy: userToToggle.username,
        timestamp: new Date(),
        refId: `STATUS_CHG_${userToToggle._id}`,
        customerNoDisplay: `User: ${userToToggle.username}`,
    });

    return { success: true, message: `User '${userToToggle.username}' has been ${users[userIndex].isDisabled ? 'disabled' : 'enabled'}.` };
  } catch (error) {
    console.error("Error toggling user status:", error);
    return { success: false, message: error instanceof Error ? error.message : "An unknown error occurred." };
  }
}


// --- Functions for PIN failure tracking ---

export async function updateUserFailedPinAttempts(userId: string): Promise<number> {
    const users = await readDb<StoredUser[]>("users");
    const userIndex = users.findIndex(u => u._id === userId);
    if (userIndex === -1) return 0;

    const currentAttempts = users[userIndex].failedPinAttempts || 0;
    const newAttempts = currentAttempts + 1;
    users[userIndex].failedPinAttempts = newAttempts;

    await writeDb("users", users);
    return newAttempts;
}

export async function resetUserFailedPinAttempts(userId: string): Promise<void> {
    const users = await readDb<StoredUser[]>("users");
    const userIndex = users.findIndex(u => u._id === userId);
    if (userIndex === -1) return;

    if (users[userIndex].failedPinAttempts && users[userIndex].failedPinAttempts! > 0) {
        users[userIndex].failedPinAttempts = 0;
        await writeDb("users", users);
    }
}

export async function disableUserAccount(userId: string): Promise<void> {
    const users = await readDb<StoredUser[]>("users");
    const userIndex = users.findIndex(u => u._id === userId);
    if (userIndex === -1) return;

    users[userIndex].isDisabled = true;
    await writeDb("users", users);
    console.log(`Account for user ID ${userId} has been disabled due to too many failed PIN attempts.`);
}
