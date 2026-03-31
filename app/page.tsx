"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Bus,
  Search,
  User,
  Phone,
  MapPin,
  CalendarDays,
  Ticket,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock3,
  GraduationCap,
  LocateFixed,
  Flag,
  RefreshCw,
} from "lucide-react";

type StatusType = "pending" | "approved" | "rejected" | "waitlisted";
type UnitType = "A Unit" | "B Unit" | "C Unit";
type TravelUpdateType = "none" | "departing" | "arriving";

type Application = {
  id?: string;
  ticketId: string;
  name: string;
  phone: string;
  seat: string;
  unit: UnitType;
  status: StatusType;
  createdAt: string;
  travelUpdate?: TravelUpdateType;
  travelUpdatedAt?: string | null;
  rejectionNote?: string | null;
};

const ROUTE_TITLE = "চট্টগ্রাম অক্সিজেন → রাঙামাটি";
const ROUTE_FROM = "চট্টগ্রাম অক্সিজেন";
const ROUTE_TO = "রাঙামাটি";
const ROUTE_TIME = "সকাল ৬:৩০ টা";
const UNITS: UnitType[] = ["A Unit", "B Unit", "C Unit"];

const seatLayout: (string | null)[][] = [
  ["A1", "A2", null, null, null, null, "A3", "A4"],
  ["B1", "B2", null, null, null, null, "B3", "B4"],
  ["C1", "C2", null, null, null, null, "C3", "C4"],
  ["D1", "D2", null, null, null, null, "D3", "D4"],
  ["E1", "E2", null, null, null, null, "E3", "E4"],
  ["F1", "F2", null, null, null, null, "F3", "F4"],
  ["G1", "G2", null, null, null, null, "G3", "G4"],
  ["H1", "H2", null, null, null, null, "H3", "H4"],
  ["I1", "I2", "J1", "J2", "I3", "I4"],
];

const ALL_SEATS = seatLayout.flat().filter(Boolean) as string[];

function maskPhone(phone: string) {
  if (phone.length < 11) return phone;
  return `${phone.slice(0, 3)}*****${phone.slice(-3)}`;
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function statusBadgeText(status: StatusType) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "waitlisted") return "Waitlisted";
  return "Pending";
}

function statusClass(status: StatusType) {
  if (status === "approved") {
    return "bg-green-100 text-green-800 border border-green-200";
  }
  if (status === "rejected") {
    return "bg-red-100 text-red-700 border border-red-200";
  }
  if (status === "waitlisted") {
    return "bg-amber-100 text-amber-700 border border-amber-200";
  }
  return "bg-white text-green-800 border border-green-200";
}

function travelUpdateText(update?: TravelUpdateType) {
  if (update === "departing") return "Departing";
  if (update === "arriving") return "Arriving";
  return "No update";
}

function travelUpdateClass(update?: TravelUpdateType) {
  if (update === "departing") {
    return "bg-sky-100 text-sky-800 border border-sky-200";
  }
  if (update === "arriving") {
    return "bg-violet-100 text-violet-800 border border-violet-200";
  }
  return "bg-slate-100 text-slate-700 border border-slate-200";
}

function formatDateTime(value?: string | null) {
  if (!value) return "No update";
  return new Date(value).toLocaleString();
}

export default function RMSTUBusApplicationPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [unit, setUnit] = useState<UnitType>("A Unit");
  const [selectedSeat, setSelectedSeat] = useState("");
  const [message, setMessage] = useState("");
  const [latestApplication, setLatestApplication] = useState<Application | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<Application[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [showMarchPopup, setShowMarchPopup] = useState(false);
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);
  const CACHE_DURATION = 5 * 60 * 1000;

  const loadApplications = useCallback(async (force: boolean = false) => {
    const now = Date.now();
    
    if (!force && now - lastLoadTime < CACHE_DURATION) {
      console.log("📦 Using cached data, skipping fetch");
      return;
    }

    setIsLoadingData(true);
    try {
      console.log("🔄 Fetching fresh data from Firebase");
      const snapshot = await getDocs(collection(db, "applications"));
      const data = snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as Application) }))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      setApplications(data);
      setLastLoadTime(now);
      setMessage("");
    } catch (error) {
      console.error(error);
      setMessage("Data load করা যায়নি। একটু পরে আবার চেষ্টা করুন।");
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadApplications();

    const now = new Date();
    if (now.getMonth() === 2 && now.getDate() === 26) {
      setShowMarchPopup(true);
    }
  }, [loadApplications]);

  const getUpdatedLatestApplication = () => {
    if (!latestApplication) return null;
    const updated = applications.find((item) => item.ticketId === latestApplication.ticketId);
    return updated || latestApplication;
  };

  const getWaitingSerial = (application: Application) => {
    // Rejected হয়েছে তাদের জন্য waiting serial নেই
    if (application.status === "rejected") return null;
    
    // এই সিটে যত জন apply করেছে সব, সময় অনুযায়ী সাজানো
    const allForSameSeat = applications
      .filter(
        (item) =>
          item.seat === application.seat &&
          item.unit === application.unit
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    const myIndex = allForSameSeat.findIndex((item) => item.id === application.id);
    if (myIndex === -1) return null;
    
    // Approved এবং Rejected ছাড়া অন্যরা (pending/waitlisted) যারা আমার আগে apply করেছে
    const unApprovedBefore = allForSameSeat
      .slice(0, myIndex)
      .filter((item) => item.status !== "approved" && item.status !== "rejected");
    
    const waitingPosition = unApprovedBefore.length;
    return waitingPosition >= 0 ? waitingPosition : null;
  };

  const totalSeats = useMemo(() => ALL_SEATS.length, []);

  const approvedSeatsForSelectedUnit = useMemo(() => {
    return applications
      .filter((item) => item.status === "approved" && item.unit === unit)
      .map((item) => item.seat);
  }, [applications, unit]);

  const waitingCountsBySeatForSelectedUnit = useMemo(() => {
    const map: Record<string, number> = {};
    applications
      .filter((item) => item.status === "pending" && item.unit === unit)
      .forEach((item) => {
        map[item.seat] = (map[item.seat] || 0) + 1;
      });
    return map;
  }, [applications, unit]);

  const approvedCount = applications.filter((item) => item.status === "approved").length;
  const availableSeatsForSelectedUnit = totalSeats - approvedSeatsForSelectedUnit.length;

  const pendingCount = applications.filter((item) => item.status === "pending").length;
  const pendingCountForSelectedUnit = applications.filter(
    (item) => item.status === "pending" && item.unit === unit
  ).length;

  const rejectedCount = applications.filter((item) => item.status === "rejected").length;
  const waitlistedCount = applications.filter((item) => item.status === "waitlisted").length;

  const aUnitCount = applications.filter((item) => item.unit === "A Unit").length;
  const bUnitCount = applications.filter((item) => item.unit === "B Unit").length;
  const cUnitCount = applications.filter((item) => item.unit === "C Unit").length;

  const aUnitApproved = applications.filter(
    (item) => item.unit === "A Unit" && item.status === "approved"
  ).length;
  const bUnitApproved = applications.filter(
    (item) => item.unit === "B Unit" && item.status === "approved"
  ).length;
  const cUnitApproved = applications.filter(
    (item) => item.unit === "C Unit" && item.status === "approved"
  ).length;

  const aUnitWaiting = applications.filter(
    (item) => item.unit === "A Unit" && item.status === "pending"
  ).length;
  const bUnitWaiting = applications.filter(
    (item) => item.unit === "B Unit" && item.status === "pending"
  ).length;
  const cUnitWaiting = applications.filter(
    (item) => item.unit === "C Unit" && item.status === "pending"
  ).length;

  const generateTicketId = () => {
    const random = Math.floor(100000 + Math.random() * 900000);
    return `RMSTU-${random}`;
  };

  const handleApply = async () => {
    setMessage("");
    setSearchResults([]);
    setLatestApplication(null);

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const normalizedIncomingName = normalizeName(cleanName);

    if (!cleanName || !cleanPhone) {
      setMessage("নাম এবং মোবাইল নম্বর দিন।");
      return;
    }

    if (!/^01\d{9}$/.test(cleanPhone)) {
      setMessage("সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন।");
      return;
    }

    if (!selectedSeat) {
      setMessage("একটি সিট নির্বাচন করুন।");
      return;
    }

    setIsSubmitting(true);

    try {
      const samePhoneQuery = query(
        collection(db, "applications"),
        where("phone", "==", cleanPhone)
      );
      const samePhoneSnapshot = await getDocs(samePhoneQuery);
      const samePhoneApplications = samePhoneSnapshot.docs.map((d) => d.data() as Application);

      const duplicateSameName = samePhoneApplications.some(
        (item) => normalizeName(item.name) === normalizedIncomingName
      );

      if (duplicateSameName) {
        setMessage("একই মোবাইল নম্বর দিয়ে একই নাম ব্যবহার করে আবার আবেদন করা যাবে না।");
        setIsSubmitting(false);
        return;
      }

      let ticketId = generateTicketId();
      let ticketQuery = query(collection(db, "applications"), where("ticketId", "==", ticketId));
      let ticketSnapshot = await getDocs(ticketQuery);

      while (!ticketSnapshot.empty) {
        ticketId = generateTicketId();
        ticketQuery = query(collection(db, "applications"), where("ticketId", "==", ticketId));
        ticketSnapshot = await getDocs(ticketQuery);
      }

      const application: Application = {
        ticketId,
        name: cleanName,
        phone: cleanPhone,
        seat: selectedSeat,
        unit,
        status: "pending",
        createdAt: new Date().toISOString(),
        travelUpdate: "none",
        travelUpdatedAt: null,
        rejectionNote: null,
      };

      await addDoc(collection(db, "applications"), application);

      setLatestApplication(application);
      setMessage("আপনার আবেদন গ্রহণ করা হয়েছে। এখন এটি pending আছে।");
      setSelectedSeat("");
      setName("");
      setPhone("");
      setUnit("A Unit");
      await loadApplications();
    } catch (error) {
      console.error(error);
      setMessage("কোনো সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearch = async () => {
    setMessage("");
    const value = searchValue.trim().toLowerCase();

    if (!value) {
      setSearchResults([]);
      setMessage("টিকেট আইডি বা মোবাইল নম্বর লিখুন।");
      return;
    }

    try {
      let found: Application[] = [];

      if (/^01\d{9}$/.test(value)) {
        const phoneQuery = query(collection(db, "applications"), where("phone", "==", value));
        const phoneSnapshot = await getDocs(phoneQuery);
        found = phoneSnapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Application),
        }));
      } else {
        const ticketQuery = query(
          collection(db, "applications"),
          where("ticketId", "==", value.toUpperCase())
        );
        const ticketSnapshot = await getDocs(ticketQuery);
        found = ticketSnapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Application),
        }));
      }

      found.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (found.length === 0) {
        setSearchResults([]);
        setMessage("কোনো আবেদন পাওয়া যায়নি।");
        return;
      }

      setSearchResults(found);
    } catch (error) {
      console.error(error);
      setSearchResults([]);
      setMessage("Search করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
  };


  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f3fbf5_0%,#ffffff_60%,#fff7f7_100%)] px-3 py-4 sm:px-4 md:px-6">
      {showMarchPopup && (
        <div className="fixed inset-x-0 top-0 z-50 border-b border-red-700 bg-gradient-to-r from-green-700 via-red-600 to-green-700 text-white shadow-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex flex-col gap-2 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white font-medium">২৬ মার্চ</span>
                <span className="text-xs text-white/85">২৬ এর ২৬ এ মার্চে স্মরণে থাকুক আমাদের ৭১ এবং ২৪ এর শহীদরা।</span>
              </div>
              <p className="text-lg font-bold text-white">স্বাধীনতা দিবসের শুভেচ্ছা।</p>
              <p className="text-xs text-white/90">- বাংলাদেশ জাতীয়তাবাদী ছাত্রদল, রাঙ্গামাটি বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয় শাখা।</p>
            </div>
            <button
              className="rounded-xl border border-white/70 bg-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/90 hover:text-red-700 ml-4"
              onClick={() => setShowMarchPopup(false)}
            >
              clear
            </button>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <div className="flex justify-end gap-2">
          <a href="/admin">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border-red-300 text-red-800 hover:bg-red-50"
            >
              Admin Access
            </Button>
          </a>
          <Button
            type="button"
            variant="outline"
            onClick={() => loadApplications()}
            disabled={isLoadingData}
            className="rounded-2xl border-green-200 text-green-800"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingData ? "animate-spin" : ""}`} />
            {isLoadingData ? "Refreshing..." : "Refresh Data"}
          </Button>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-green-100 bg-white shadow-[0_24px_70px_rgba(0,0,0,0.08)]">
          <div className="relative bg-[linear-gradient(180deg,#0f8b46_0%,#169a4b_32%,#c84444_100%)] p-5 text-white sm:p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_center,rgba(255,255,255,0.16),transparent_30%),radial-gradient(circle_at_center,rgba(255,255,255,0.05),transparent_40%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0)_35%,rgba(0,0,0,0.03)_100%)]" />

            <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="rounded-3xl border border-white/20 bg-white/10 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-md">
                  <Bus className="h-7 w-7 sm:h-8 sm:w-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
                    RMSTU GST Admission Bus Ticket
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-white/95 sm:text-base">
                    Rangamati Science and Technology University-তে GST admission test দিতে আসা
                    শিক্ষার্থীদের জন্য বাংলাদেশ জাতীয়তাবাদী ছাত্রদল, রাঙ্গামাটি বিজ্ঞান ও প্রযুক্তি
                    বিশ্ববিদ্যালয় শাখার পক্ষ থেকে বাস সরবরাহ করা হচ্ছে। টিকেট কাটুন এখান থেকে।
                  </p>
                  <p className="mt-3 text-sm text-white/95">
                    This web app was developed by{" "}
                    <a
                      href="https://www.facebook.com/sikder67991"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline decoration-white/80 underline-offset-4 hover:text-green-100"
                    >
                      Tasfique Shikder Koushik
                    </a>
                    .
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-5">
                <div className="rounded-3xl border border-white/20 bg-white/10 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-md">
                  <div className="text-lg font-bold sm:text-xl">{totalSeats}</div>
                  <div className="text-[11px] text-white/85 sm:text-xs">মোট সিট</div>
                </div>

                <div className="rounded-3xl border border-white/20 bg-white/10 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-md">
                  <div className="text-lg font-bold sm:text-xl">{pendingCountForSelectedUnit}</div>
                  <div className="text-[11px] text-white/85 sm:text-xs">{unit} Pending</div>
                </div>

                <div className="rounded-3xl border border-white/20 bg-white/10 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-md">
                  <div className="text-lg font-bold sm:text-xl">{pendingCount}</div>
                  <div className="text-[11px] text-white/85 sm:text-xs">Total Pending</div>
                </div>

                <div className="rounded-3xl border border-white/20 bg-white/10 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-md">
                  <div className="text-lg font-bold sm:text-xl">{approvedCount}</div>
                  <div className="text-[11px] text-white/85 sm:text-xs">Approved</div>
                </div>

                <div className="rounded-3xl border border-white/20 bg-white/10 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-md">
                  <div className="text-lg font-bold sm:text-xl">{availableSeatsForSelectedUnit}</div>
                  <div className="text-[11px] text-white/85 sm:text-xs">এই ইউনিটে খালি সিট</div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-[6px] w-full bg-[linear-gradient(90deg,#1b9c4d_0%,#f0f7f1_50%,#db5050_100%)]" />
        </div>

        <div className="grid gap-4 xl:grid-cols-3 xl:gap-6">
          <div className="space-y-4 xl:col-span-2 xl:space-y-6">
            <Card className="rounded-[28px] border border-green-100 bg-white shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-green-800 sm:text-xl">Ticket</CardTitle>
              </CardHeader>
              <CardContent className="rounded-3xl bg-green-50/70 p-4 text-sm text-slate-700 sm:text-base">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-red-100 p-2.5 text-red-600">
                    <MapPin className="mt-0.5 h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="font-semibold text-green-900">{ROUTE_TITLE}</div>
                    <div className="text-slate-700">
                      {ROUTE_FROM} → {ROUTE_TO}
                    </div>
                    <div className="font-medium text-red-700">ছাড়ার সময়: {ROUTE_TIME}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border border-green-100 bg-white shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-green-800 sm:text-xl">
                  Ticket Application
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-green-900">নাম</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 h-4 w-4 text-green-500" />
                    <Input
                      className="h-11 rounded-2xl border-green-200 pl-10 text-base focus-visible:ring-green-500"
                      placeholder="পূর্ণ নাম লিখুন"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-green-900">মোবাইল নম্বর</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3.5 h-4 w-4 text-green-500" />
                    <Input
                      type="tel"
                      inputMode="numeric"
                      className="h-11 rounded-2xl border-green-200 pl-10 text-base focus-visible:ring-green-500"
                      placeholder="01XXXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-green-900">আপনি কোন ইউনিটে পরীক্ষা দিবেন?</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {UNITS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setUnit(item);
                          setSelectedSeat("");
                        }}
                        className={`rounded-2xl border px-3 py-3 text-sm font-medium transition ${
                          unit === item
                            ? "border-red-600 bg-red-600 text-white shadow-sm"
                            : "border-green-200 bg-white text-green-800 hover:bg-green-50"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2 rounded-2xl border border-red-100 bg-red-50 p-4 text-xs leading-6 text-red-800 sm:text-sm">
                  প্রতিটি ইউনিটের waiting এবং approved সিট আলাদা আলাদা গণনা করা হবে। অর্থাৎ A Unit,
                  B Unit, C Unit — প্রত্যেক ইউনিটের জন্য seat waiting list এবং approval আলাদা থাকবে।
                  সিটের উপরে <strong>W-1</strong>, <strong>W-2</strong> এভাবে দেখাবে, যা এই ইউনিটে
                  ঐ সিটের waiting আবেদনকারীর সংখ্যা বোঝাবে।
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border border-green-100 bg-white shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-green-800 sm:text-xl">
                  <Ticket className="h-5 w-5 text-red-600" /> সিট নির্বাচন ও আবেদন
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-center text-sm font-medium text-green-900">
                  Driver
                </div>

                <div className="space-y-2 sm:space-y-3">
                  {seatLayout.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex items-center justify-center gap-2 sm:gap-3">
                      {row.map((seat, seatIndex) => {
                        if (!seat) {
                          return <div key={`${rowIndex}-${seatIndex}-gap`} className="w-4 sm:w-6" />;
                        }
                        const isApproved = approvedSeatsForSelectedUnit.includes(seat);
                        const waitingCountForSeat = waitingCountsBySeatForSelectedUnit[seat] || 0;
                        const isSelected = selectedSeat === seat;

                        return (
                          <button
                            key={seat}
                            type="button"
                            disabled={isApproved || isSubmitting}
                            onClick={() => setSelectedSeat(seat)}
                            className={`relative h-12 w-12 rounded-2xl border text-sm font-semibold transition sm:h-14 sm:w-14 ${
                              isApproved
                                ? "cursor-not-allowed border-red-200 bg-red-100 text-red-700"
                                : isSelected
                                ? "border-green-800 bg-green-700 text-white"
                                : waitingCountForSeat > 0
                                ? "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200"
                                : "border-green-200 bg-white text-green-800 hover:bg-green-50"
                            }`}
                          >
                            {seat}
                            {waitingCountForSeat > 0 && !isApproved && (
                              <span className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
                                W-{waitingCountForSeat}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex items-center gap-2 rounded-xl bg-white p-2">
                    <span className="h-4 w-4 rounded border border-green-200 bg-white" /> Apply করা যায়
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-green-50 p-2">
                    <span className="h-4 w-4 rounded bg-green-700" /> Selected
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-2">
                    <span className="h-4 w-4 rounded bg-amber-200" /> Waiting আছে
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-red-50 p-2">
                    <span className="h-4 w-4 rounded bg-red-200" /> Approved
                  </div>
                </div>

                <div className="rounded-2xl border border-green-100 bg-green-50/70 p-4 text-sm text-slate-700 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span>নির্বাচিত রুট</span>
                    <span className="text-right font-semibold text-green-900">{ROUTE_TITLE}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>নির্বাচিত ইউনিট</span>
                    <span className="font-semibold text-red-700">{unit}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>নির্বাচিত সিট</span>
                    <span className="font-semibold text-red-700">
                      {selectedSeat || "এখনো সিট নির্বাচন করা হয়নি"}
                    </span>
                  </div>
                </div>

                <Button
                  className="h-12 w-full rounded-2xl bg-red-600 text-base text-white hover:bg-red-700"
                  onClick={handleApply}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "আবেদন পাঠানো হচ্ছে..." : "আবেদন করুন"}
                </Button>

                {message && (
                  <div className="rounded-2xl border border-green-200 bg-white p-4 text-sm leading-6 text-slate-700 shadow-sm">
                    {message}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 xl:space-y-6">
            <Card className="rounded-[28px] border border-green-100 bg-white shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-green-800 sm:text-xl">
                  <Search className="h-5 w-5 text-red-600" /> Ticket Search / Approval check
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-green-900">টিকেট আইডি বা মোবাইল নম্বর</Label>
                  <Input
                    type="text"
                    inputMode="text"
                    className="h-11 rounded-2xl border-green-200 text-base focus-visible:ring-green-500"
                    placeholder="RMSTU-123456 বা 01XXXXXXXXX"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                  />
                </div>
                <Button
                  className="h-11 w-full rounded-2xl bg-green-700 text-base text-white hover:bg-green-800"
                  onClick={handleSearch}
                >
                  সার্চ করুন
                </Button>

                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    {searchResults.map((item) => (
                      <div
                        key={item.ticketId}
                        className={`rounded-3xl border p-4 text-sm leading-6 shadow-sm ${
                          item.status === "rejected" ? "border-red-300 bg-red-50" : "border-green-100 bg-white"
                        }`}
                      >
                        {item.status === "rejected" && item.rejectionNote && (
                          <div className="mb-3 rounded-2xl border-2 border-red-400 bg-red-100 px-4 py-2">
                            <span className="block font-bold text-red-700">রিজেকশনের কারণ:</span>
                            <span className="block font-medium text-red-800 mt-1">{item.rejectionNote}</span>
                          </div>
                        )}

                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className="font-semibold text-green-900">আবেদন পাওয়া গেছে</span>
                          <div className="flex items-center gap-2">
                            <Badge className={`rounded-full ${statusClass(item.status)}`}>
                              {statusBadgeText(item.status)}
                            </Badge>
                            {getWaitingSerial(item) !== null && (
                              <Badge className="rounded-full border border-amber-300 bg-amber-100 text-amber-800">
                                W-{getWaitingSerial(item)}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1 text-slate-700">
                          <div>
                            <span className="font-medium">টিকেট আইডি:</span> {item.ticketId}
                          </div>
                          <div>
                            <span className="font-medium">নাম:</span> {item.name}
                          </div>
                          <div>
                            <span className="font-medium">মোবাইল:</span> {maskPhone(item.phone)}
                          </div>
                          <div>
                            <span className="font-medium">ইউনিট:</span> {item.unit}
                          </div>
                          <div>
                            <span className="font-medium">রুট:</span> {ROUTE_TITLE}
                          </div>
                          <div>
                            <span className="font-medium">সিট:</span> {item.seat}
                          </div>
                          {item.status === "approved" && (
                            <div className="mt-2 rounded-2xl border-2 border-green-400 bg-green-50 px-3 py-2">
                              <span className="font-bold text-green-800">
                                ✓ Congratulations! আপনার seat টি Approve হয়েছে। 01643097477 এই number এ whatsapp এ knock দিয়ে Bus Group এ Join হয়ে নিন।
                              </span>
                            </div>
                          )}
                          {(() => {
                            const serial = getWaitingSerial(item);
                            if (serial !== null && item.status !== "approved") {
                              const isAOrBUnit = item.unit === "A Unit" || item.unit === "B Unit";
                              const message = (serial === 0 && isAOrBUnit)
                                ? "অভিনন্দন, আপনি সবার প্রথমে আবেদন করেছেন। C ইউনিটের এক্সামের পর সবার আগে আপনার সাথে যোগাযোগ করা হবে।অপেক্ষা করুন"
                                : serial === 0
                                ? "আপনাকে Call দেওয়া হবে অথবা আপনি 01643097477 এই নম্বরে whatsapp e knock দিয়ে Seat Approve করুন।"
                                : "অপেক্ষা করুন";
                              return (
                                <div className="mt-2 rounded-2xl border-2 border-amber-300 bg-amber-50 px-3 py-2">
                                  <span className="font-bold text-amber-800">
                                    ✓ Waiting Position: W-{serial} ({message})
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          <div className="pt-2">
                            <span className="font-medium">Travel Update:</span>{" "}
                            <Badge className={`ml-2 rounded-full ${travelUpdateClass(item.travelUpdate)}`}>
                              {travelUpdateText(item.travelUpdate)}
                            </Badge>
                          </div>
                          <div>
                            <span className="font-medium">Update Time:</span>{" "}
                            {formatDateTime(item.travelUpdatedAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {latestApplication && (
              <Card className="rounded-[28px] border border-green-100 bg-white shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-green-800 sm:text-xl">
                    <ShieldCheck className="h-5 w-5 text-red-600" /> সদ্য করা আবেদন
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const displayApp = getUpdatedLatestApplication() || latestApplication;
                    return (
                      <div className="rounded-3xl border border-red-200 bg-red-50/50 p-4 sm:p-5">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm text-slate-500">Ticket ID</div>
                            <div className="text-base font-bold text-green-900 sm:text-lg">
                              {displayApp.ticketId}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`rounded-full ${statusClass(displayApp.status)}`}>
                              {statusBadgeText(displayApp.status)}
                            </Badge>
                            {getWaitingSerial(displayApp) !== null && (
                              <Badge className="rounded-full border border-amber-300 bg-amber-100 text-amber-800">
                                W-{getWaitingSerial(displayApp)}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3 text-sm text-slate-700">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-green-700" /> {displayApp.name}
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-green-700" /> {displayApp.phone}
                          </div>
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-4 w-4 text-red-600" /> {displayApp.unit}
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-red-600" /> {ROUTE_TITLE}
                          </div>
                          <div className="flex items-center gap-2">
                            <Bus className="h-4 w-4 text-green-700" /> Seat {displayApp.seat}
                          </div>
                          {displayApp.status === "approved" && (
                            <div className="rounded-2xl border-2 border-green-400 bg-green-50 px-3 py-2">
                              <span className="font-bold text-green-800">
                                ✓ Congratulations! আপনার seat টি Approve হয়েছে। 01643097477 এই number এ whatsapp এ knock দিয়ে Bus Group এ Join হয়ে নিন।
                              </span>
                            </div>
                          )}
                          {(() => {
                            const serial = getWaitingSerial(displayApp);
                            if (serial !== null && displayApp.status !== "approved") {
                              const isAOrBUnit = displayApp.unit === "A Unit" || displayApp.unit === "B Unit";
                              const message = (serial === 0 && isAOrBUnit)
                                ? "অভিনন্দন, আপনি সবার প্রথমে আবেদন করেছেন। C ইউনিটের এক্সামের পর সবার আগে আপনার সাথে যোগাযোগ করা হবে।অপেক্ষা করুন"
                                : serial === 0
                                ? "আপনাকে Call দেওয়া হবে অথবা আপনি 01643097477 এই নম্বরে whatsapp e knock দিয়ে Seat Approve করুন।"
                                : "অপেক্ষা করুন";
                              return (
                                <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-3 py-2">
                                  <span className="font-bold text-amber-800">
                                    ✓ আপনার অবস্থান: W-{serial} ({message})
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-red-600" />
                            {displayApp.status === "approved" && "Approved ✓"}
                            {displayApp.status === "rejected" && "Rejected"}
                            {displayApp.status === "waitlisted" && `Waitlisted (W-${getWaitingSerial(displayApp)})`}
                            {displayApp.status === "pending" && "Pending approval"}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock3 className="h-4 w-4 text-slate-600" /> No update
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            <Card className="rounded-[28px] border border-green-100 bg-white shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-green-800 sm:text-xl">
                  গুরুত্বপূর্ণ নির্দেশনা
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal space-y-2 pl-5 text-sm leading-7 text-slate-700 sm:text-base">
                  <li>Approved সিটে আর আবেদন করা যাবে না</li>
                  <li>Waiting/Pending সিটে একাধিক আবেদন করা যাবে</li>
                  <li>সিটের উপরে W-1, W-2 ইত্যাদি দেখানো হবে, যা waiting আবেদনকারীর সংখ্যা বোঝাবে</li>
                  <li>A Unit, B Unit, C Unit — প্রতিটি ইউনিটের waiting এবং approved আলাদা</li>
                  <li>একই মোবাইল নম্বর দিয়ে সর্বোচ্চ ৩টি আবেদন করা যাবে</li>
                  <li>একই নাম্বার দিয়ে আলাদা আলাদা সময়ে, আলাদা আলাদা নাম দিয়ে আবেদন করতে হবে</li>
                  <li>যাত্রা শুরু হলে admin panel থেকে Departing update করা যাবে</li>
                  <li>গন্তব্যে পৌঁছালে admin panel থেকে Arriving update করা যাবে</li>
                  <li>Admin চাইলে pending / waitlisted applicant-কে অন্য seat assign করতে পারবেন</li>
                  <li>Reject করলে admin note/reason save করা যাবে</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}