
// src/app/(app)/tools/game-nickname-checker/page.tsx
"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserCircle2, Server, Search, Contact, AlertTriangle, UserCheck, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { inquireFreeFireNickname, type InquireFreeFireNicknameOutput } from '@/ai/flows/inquire-free-fire-nickname-flow';
import { inquireMobileLegendsNickname, type InquireMobileLegendsNicknameOutput } from '@/ai/flows/inquire-mobile-legends-nickname-flow';
import { inquireGenshinImpactNickname, type InquireGenshinImpactNicknameInput } from '@/ai/flows/inquire-genshin-impact-nickname-flow';
import { inquireHonkaiStarRailNickname, type InquireHonkaiStarRailNicknameInput, type HonkaiStarRailRegion } from '@/ai/flows/inquire-honkai-star-rail-nickname-flow';
import ProtectedRoute from "@/components/core/ProtectedRoute";

const gameOptions = [
  { value: "free-fire", label: "Free Fire" },
  { value: "mobile-legends", label: "Mobile Legends" },
  { value: "genshin-impact", label: "Genshin Impact" },
  { value: "honkai-star-rail", label: "Honkai Star Rail" },
];

const genshinImpactServers: InquireGenshinImpactNicknameInput['zoneId'][] = ["Asia", "America", "Europe", "TW, HK, MO"];
const honkaiStarRailRegions: HonkaiStarRailRegion[] = ["Asia", "America", "Europe", "TW, HK, MO"];

const formSchema = z.object({
  game: z.string().min(1, "Please select a game"),
  userId: z.string().min(5, "User ID must be at least 5 characters"),
  zoneId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function GameNicknameCheckerPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [inquiryResult, setInquiryResult] = useState<any | null>(null);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { game: "", userId: "", zoneId: "" },
  });

  const selectedGame = watch("game");

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setInquiryResult(null);
    try {
      let result;
      switch (data.game) {
        case "free-fire":
          result = await inquireFreeFireNickname({ userId: data.userId });
          break;
        case "mobile-legends":
          if (!data.zoneId) {
            toast({ title: "Validation Error", description: "Zone ID is required for Mobile Legends.", variant: "destructive" });
            setIsLoading(false);
            return;
          }
          result = await inquireMobileLegendsNickname({ userId: data.userId, zoneId: data.zoneId });
          break;
        case "genshin-impact":
           if (!data.zoneId) {
            toast({ title: "Validation Error", description: "Server/Zone ID is required for Genshin Impact.", variant: "destructive" });
            setIsLoading(false);
            return;
          }
          result = await inquireGenshinImpactNickname({ userId: data.userId, zoneId: data.zoneId as any });
          break;
        case "honkai-star-rail":
           if (!data.zoneId) {
            toast({ title: "Validation Error", description: "Server Region is required for Honkai Star Rail.", variant: "destructive" });
            setIsLoading(false);
            return;
          }
          result = await inquireHonkaiStarRailNickname({ userId: data.userId, region: data.zoneId as any });
          break;
        default:
          throw new Error("Invalid game selected");
      }
      setInquiryResult(result);
      if(result.isSuccess && result.nickname) {
        toast({ title: "Inquiry Successful", description: `Nickname found: ${result.nickname}` });
      } else if (result.isSuccess && !result.nickname) {
        toast({ title: "Inquiry Note", description: result.message || "User found but no nickname returned." });
      } else {
        toast({ title: "Inquiry Failed", description: result.message || "Could not find user.", variant: "destructive" });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setInquiryResult({ isSuccess: false, message: errorMessage });
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const renderResult = () => {
    if (!inquiryResult) return null;
    const isSuccess = inquiryResult.isSuccess && inquiryResult.nickname;
    const isFoundButNoNickname = inquiryResult.isSuccess && !inquiryResult.nickname;

    return (
      <div className={`mt-6 p-4 rounded-md text-sm ${isSuccess ? 'bg-green-50 border border-green-200 text-green-700' : isFoundButNoNickname ? 'bg-blue-50 border border-blue-200 text-blue-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
        {isSuccess ? (
          <>
            <p className="font-semibold flex items-center"><UserCheck className="h-4 w-4 mr-2" />Nickname Found:</p>
            <p className="text-lg font-bold">{inquiryResult.nickname}</p>
          </>
        ) : isFoundButNoNickname ? (
          <>
             <p className="font-semibold flex items-center"><Info className="h-4 w-4 mr-2" />Inquiry Note:</p>
             <p>{inquiryResult.message || "User found, but nickname not available in API response."}</p>
          </>
        ) : (
          <p className="font-semibold flex items-center"><AlertTriangle className="h-4 w-4 mr-2" />Inquiry Failed: <span className="font-normal ml-1">{inquiryResult.message || "User not found or an error occurred."}</span></p>
        )}
      </div>
    );
  };

  return (
    <ProtectedRoute requiredPermission="cek_nickname_game">
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="game-select">Game</Label>
            <Controller
              name="game"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                  <SelectTrigger id="game-select">
                    <SelectValue placeholder="Select a game..." />
                  </SelectTrigger>
                  <SelectContent>
                    {gameOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.game && <p className="text-sm text-destructive">{errors.game.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-id">User ID</Label>
            <Controller name="userId" control={control} render={({ field }) => <Input id="user-id" placeholder="Enter User ID" {...field} disabled={isLoading} />} />
            {errors.userId && <p className="text-sm text-destructive">{errors.userId.message}</p>}
          </div>

          {selectedGame === "mobile-legends" && (
            <div className="space-y-1.5">
              <Label htmlFor="zone-id">Zone ID</Label>
              <Controller name="zoneId" control={control} render={({ field }) => <Input id="zone-id" placeholder="Enter Zone ID" {...field} disabled={isLoading} />} />
              {errors.zoneId && <p className="text-sm text-destructive">{errors.zoneId.message}</p>}
            </div>
          )}

          {(selectedGame === "genshin-impact" || selectedGame === "honkai-star-rail") && (
            <div className="space-y-1.5">
              <Label htmlFor="server-select">{selectedGame === 'genshin-impact' ? 'Server / Zone ID' : 'Server Region'}</Label>
              <Controller
                  name="zoneId"
                  control={control}
                  render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                      <SelectTrigger id="server-select"><SelectValue placeholder="Select a server..." /></SelectTrigger>
                      <SelectContent>
                          {(selectedGame === 'genshin-impact' ? genshinImpactServers : honkaiStarRailRegions).map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                  )}
              />
              {errors.zoneId && <p className="text-sm text-destructive">{errors.zoneId.message}</p>}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Check Nickname
          </Button>
        </form>
        {renderResult()}
      </CardContent>
    </ProtectedRoute>
  );
}
