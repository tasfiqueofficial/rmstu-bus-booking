"use client";

import React, { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  LogIn,
  CheckCircle2,
  XCircle,
  Clock3,
  Users,
  LayoutDashboard,
} from "lucide-react";

type RouteType = "oxygen" | "khagrachhari";
type StatusType = "pending" | "approved" | "rejected" | "waitlisted";

type Application = {
  id?: string;
  ticketId: string;
  name: string;
  phone: string;
  route: RouteType;
  seat: string;
  status: StatusType;
  createdAt: string;
};

const ROUTES: Record<
  RouteType,
  { title: string; from: string; to: string; departure: string }
> = {
  oxygen: {
    title: "চট্টগ্রাম অক্সিজেন → রাঙামাটি",
    from: "চট্টগ্রাম অক্সিজেন",
    to: "রাঙামাটি",
    departure: "সকাল ৭:০০ টা",
  },
  khagrachhari: {
    title: "খাগড়াছড়ি → রাঙামাটি",
    from: "খাগড়াছড়ি",
    to: "রাঙামাটি",
    departure: "সকাল ৭:৩০ টা",
  },
};

const seatLayout = [
  ["A1", "A2", null, "A3", "A4"],
  ["B1", "B2", null, "B3", "B4"],
  ["C1", "C2", null, "C3", "C4"],
  ["D1", "D2", null, "D3", "D4"],
  ["E1", "E2", null, "E3", "E4"],
  ["F1", "F2", null, "F3", "F4"],
];

const ADMIN_PASSCODE = "rmstu-admin-2026";

function maskPhone(phone: string) {
  if (phone.length < 11) return phone;
  return `${phone.slice(0, 3)}*****${phone.slice(-3)}`;
}

function statusBadgeText(status: StatusType) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "waitlisted") return "Waitlisted";
  return "Pending";
}

function statusClass(status: StatusType) {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  if (status === "waitlisted") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default function RMSTUBusApplicationPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedRoute, setSelectedRoute] = useState<RouteType>("oxygen");
  const [selectedSeat, setSelectedSeat] = useState("");
  const [message, setMessage] = useState("");
  const [latestApplication, setLatestApplication] = useState<Application | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<Application[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminFilter, setAdminFilter] = useState<StatusType | "all">("pending");
  const [adminRouteFilter, setAdminRouteFilter] = useState<RouteType | "all">("all");
  const [adminBusyId, setAdminBusyId] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "applications"), (snapshot) => {
      const data = snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as Application) }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setApplications(data);
    });

    return () => unsub();
  }, []);

  const totalSeats = seatLayout.flat().filter(Boolean).length;
  const currentRouteInfo = ROUTES[selectedRoute];

  const approvedSeatsByRoute = useMemo(() => {
    return applications
      .filter((item) => item.status === "approved" && item.route === selectedRoute)
      .map((item) => item.seat);
  }, [applications, selectedRoute]);

  const pendingCountsBySeat = useMemo(() => {
    const map: Record<string, number> = {};
    applications
      .filter((item) => item.route === selectedRoute && item.status === "pending")
      .forEach((item) => {
        map[item.seat] = (map[item.seat] || 0) + 1;
      });
    return map;
  }, [applications, selectedRoute]);

  const approvedOxygen = applications.filter(
    (item) => item.route === "oxygen" && item.status === "approved"
  ).length;
  const approvedKhagra = applications.filter(
    (item) => item.route === "khagrachhari" && item.status === "approved"
  ).length;
  const oxygenAvailable = totalSeats - approvedOxygen;
  const khagraAvailable = totalSeats - approvedKhagra;

  const pendingCount = applications.filter((item) => item.status === "pending").length;
  const approvedCount = applications.filter((item) => item.status === "approved").length;
  const rejectedCount = applications.filter((item) => item.status === "rejected").length;
  const waitlistedCount = applications.filter((item) => item.status === "waitlisted").length;

  const adminApplications = applications.filter((item) => {
    const statusMatch = adminFilter === "all" ? true : item.status === adminFilter;
    const routeMatch = adminRouteFilter === "all" ? true : item.route === adminRouteFilter;
    return statusMatch && routeMatch;
  });

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
      const approvedPhoneQuery = query(
        collection(db, "applications"),
        where("phone", "==", cleanPhone),
        where("status", "==", "approved")
      );
      const approvedPhoneSnapshot = await getDocs(approvedPhoneQuery);

      if (!approvedPhoneSnapshot.empty) {
        setMessage("এই মোবাইল নম্বর দিয়ে ইতোমধ্যে একটি টিকেট approved হয়েছে।");
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
        route: selectedRoute,
        seat: selectedSeat,
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "applications"), application);
      setLatestApplication(application);
      setMessage("আপনার আবেদন গ্রহণ করা হয়েছে। এখন এটি pending আছে।");
      setSelectedSeat("");
    } catch {
      setMessage("কোনো সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearch = () => {
    setMessage("");
    const value = searchValue.trim().toLowerCase();

    if (!value) {
      setSearchResults([]);
      setMessage("টিকেট আইডি বা মোবাইল নম্বর লিখুন।");
      return;
    }

    const found = applications.filter(
      (item) =>
        item.ticketId.toLowerCase() === value || item.phone.toLowerCase() === value
    );

    if (found.length === 0) {
      setSearchResults([]);
      setMessage("কোনো আবেদন পাওয়া যায়নি।");
      return;
    }

    setSearchResults(found);
  };

  const handleAdminLogin = () => {
    if (adminPasscode === ADMIN_PASSCODE) {
      setAdminOpen(true);
      setMessage("Admin panel open হয়েছে।");
    } else {
      setMessage("ভুল admin passcode।");
    }
  };

  const updateStatus = async (application: Application, nextStatus: StatusType) => {
    if (!application.id) return;
    setAdminBusyId(application.id);
    setMessage("");

    try {
      if (nextStatus === "approved") {
        const approvedSeatQuery = query(
          collection(db, "applications"),
          where("route", "==", application.route),
          where("seat", "==", application.seat),
          where("status", "==", "approved")
        );
        const approvedSeatSnapshot = await getDocs(approvedSeatQuery);

        if (!approvedSeatSnapshot.empty) {
          setMessage("এই সিটে ইতোমধ্যে একজন approved হয়েছে।");
          setAdminBusyId("");
          return;
        }

        const approvedPhoneQuery = query(
          collection(db, "applications"),
          where("phone", "==", application.phone),
          where("status", "==", "approved")
        );
        const approvedPhoneSnapshot = await getDocs(approvedPhoneQuery);

        if (!approvedPhoneSnapshot.empty) {
          setMessage("এই মোবাইল নম্বরে ইতোমধ্যে একটি approved ticket আছে।");
          setAdminBusyId("");
          return;
        }
      }

      await updateDoc(doc(db, "applications", application.id), { status: nextStatus });

      if (nextStatus === "approved") {
        const sameSeatPending = applications.filter(
          (item) =>
            item.id !== application.id &&
            item.route === application.route &&
            item.seat === application.seat &&
            item.status === "pending"
        );

        for (const item of sameSeatPending) {
          if (item.id) {
            await updateDoc(doc(db, "applications", item.id), { status: "rejected" });
          }
        }
      }

      setMessage("Status update সফল হয়েছে।");
    } catch {
      setMessage("Status update করা যায়নি।");
    } finally {
      setAdminBusyId("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white/10 p-3">
                <Bus className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold md:text-3xl">
                  RMSTU GST Admission Bus Ticket
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-200 md:text-base">
                  Rangamati Science and Technology University-তে GST admission test দিতে আসা
                  ছাত্রছাত্রীদের জন্য বাংলাদেশ জাতীয়তাবাদী ছাত্রদল রাঙ্গামাটি বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয় শাখা -এর পক্ষ থেকে বিশেষ বাস
                  । এখানে সরাসরি ticket। আমাদের একজন প্রতিনিধি আপনাকে কল দেওয়ার মাধ্যমে আপনার টিকেটটি অ্যাপ্রুভ করবে । This web app is developed by Tasfique shikder Koushik.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-white/10 p-3 text-center">
                <div className="text-xl font-bold">2</div>
                <div className="text-xs text-slate-200">মোট বাস</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 text-center">
                <div className="text-xl font-bold">{pendingCount}</div>
                <div className="text-xs text-slate-200">Ticket Pending</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 text-center">
                <div className="text-xl font-bold">{approvedCount}</div>
                <div className="text-xs text-slate-200">Ticket Approved</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 text-center">
                <div className="text-xl font-bold">Free</div>
                <div className="text-xs text-slate-200">ভাড়া</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <LogIn className="h-5 w-5" /> Ticket
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>নাম</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <Input
                      className="rounded-2xl pl-10"
                      placeholder="পূর্ণ নাম লিখুন"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>মোবাইল নম্বর</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <Input
                      className="rounded-2xl pl-10"
                      placeholder="01XXXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>রুট নির্বাচন</Label>
                  <Select
                    value={selectedRoute}
                    onValueChange={(value) => {
                      setSelectedRoute(value as RouteType);
                      setSelectedSeat("");
                    }}
                  >
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue placeholder="রুট নির্বাচন করুন" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oxygen">চট্টগ্রাম অক্সিজেন → রাঙামাটি</SelectItem>
                      <SelectItem value="khagrachhari">খাগড়াছড়ি → রাঙামাটি</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2 rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
                  একটি মোবাইল নম্বরে একাধিক seat-এ apply করা যাবে, কিন্তু final approved হবে মাত্র
                  একটি। একই seat-এর জন্য অনেকেই apply করতে পারবে।
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">বাস রুট ও আসন অবস্থা</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border p-5">
                  <div className="text-lg font-semibold">{ROUTES.oxygen.title}</div>
                  <div className="mt-2 text-sm text-slate-500">খালি approved seat: {oxygenAvailable}</div>
                  <div className="mt-2 text-sm text-slate-500">চূড়ান্ত approved: {approvedOxygen}</div>
                </div>
                <div className="rounded-3xl border p-5">
                  <div className="text-lg font-semibold">{ROUTES.khagrachhari.title}</div>
                  <div className="mt-2 text-sm text-slate-500">খালি approved seat: {khagraAvailable}</div>
                  <div className="mt-2 text-sm text-slate-500">চূড়ান্ত approved: {approvedKhagra}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Ticket className="h-5 w-5" /> আসনের জন্য আবেদন করুন
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-2xl bg-slate-100 p-3 text-center text-sm font-medium">
                  Driver
                </div>

                <div className="space-y-3">
                  {seatLayout.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex items-center justify-center gap-3">
                      {row.map((seat) => {
                        if (!seat) return <div key={`${rowIndex}-gap`} className="w-6" />;
                        const isApproved = approvedSeatsByRoute.includes(seat);
                        const pendingCountForSeat = pendingCountsBySeat[seat] || 0;
                        const isSelected = selectedSeat === seat;

                        return (
                          <button
                            key={seat}
                            type="button"
                            disabled={isApproved || isSubmitting}
                            onClick={() => setSelectedSeat(seat)}
                            className={`relative h-12 w-12 rounded-2xl text-sm font-semibold transition ${
                              isApproved
                                ? "cursor-not-allowed bg-rose-100 text-rose-600"
                                : isSelected
                                ? "bg-slate-900 text-white"
                                : pendingCountForSeat > 0
                                ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                : "bg-slate-100 hover:bg-slate-200"
                            }`}
                          >
                            {seat}
                            {pendingCountForSeat > 0 && !isApproved && (
                              <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">
                                {pendingCountForSeat}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded bg-slate-100" /> Apply করা যায়
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded bg-slate-900" /> Selected
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded bg-amber-100" /> Pending আবেদন আছে
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded bg-rose-100" /> Final approved
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>নির্বাচিত রুট</span>
                    <span className="font-semibold">{currentRouteInfo.title}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>নির্বাচিত সিট</span>
                    <span className="font-semibold">
                      {selectedSeat || "এখনো সিট নির্বাচন করা হয়নি"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>সিস্টেম</span>
                    <span className="font-semibold">Apply → Admin Approval</span>
                  </div>
                </div>

                <Button
                  className="w-full rounded-2xl py-6 text-base"
                  onClick={handleApply}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "আবেদন পাঠানো হচ্ছে..." : "আবেদন করুন"}
                </Button>

                {message && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                    {message}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Search className="h-5 w-5" /> আবেদন / টিকেট যাচাই
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>টিকেট আইডি বা মোবাইল নম্বর</Label>
                  <Input
                    className="rounded-2xl"
                    placeholder="RMSTU-123456 বা 01XXXXXXXXX"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                  />
                </div>
                <Button className="w-full rounded-2xl" onClick={handleSearch}>
                  সার্চ করুন
                </Button>

                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    {searchResults.map((item) => (
                      <div key={item.ticketId} className="rounded-3xl border p-4 text-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="font-semibold">আবেদন পাওয়া গেছে</span>
                          <Badge className={`rounded-full ${statusClass(item.status)}`}>
                            {statusBadgeText(item.status)}
                          </Badge>
                        </div>
                        <div className="space-y-2 text-slate-700">
                          <div><span className="font-medium">টিকেট আইডি:</span> {item.ticketId}</div>
                          <div><span className="font-medium">নাম:</span> {item.name}</div>
                          <div><span className="font-medium">মোবাইল:</span> {maskPhone(item.phone)}</div>
                          <div><span className="font-medium">রুট:</span> {ROUTES[item.route].title}</div>
                          <div><span className="font-medium">সিট:</span> {item.seat}</div>
                          <div>
                            <span className="font-medium">সময়:</span> {new Date(item.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {latestApplication && (
              <Card className="rounded-3xl border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <ShieldCheck className="h-5 w-5" /> সদ্য করা আবেদন
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-3xl border border-dashed p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm text-slate-500">Ticket ID</div>
                        <div className="text-lg font-bold">{latestApplication.ticketId}</div>
                      </div>
                      <Badge className="rounded-full bg-slate-100 text-slate-700">Pending</Badge>
                    </div>

                    <div className="space-y-3 text-sm text-slate-700">
                      <div className="flex items-center gap-2"><User className="h-4 w-4" /> {latestApplication.name}</div>
                      <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> {latestApplication.phone}</div>
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {ROUTES[latestApplication.route].title}</div>
                      <div className="flex items-center gap-2"><Bus className="h-4 w-4" /> Seat {latestApplication.seat}</div>
                      <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> এখন pending approval-এ আছে</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <LayoutDashboard className="h-5 w-5" /> Admin Access
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!adminOpen ? (
                  <>
                    <Input
                      className="rounded-2xl"
                      type="password"
                      placeholder="Admin passcode"
                      value={adminPasscode}
                      onChange={(e) => setAdminPasscode(e.target.value)}
                    />
                    <Button className="w-full rounded-2xl" onClick={handleAdminLogin}>
                      Admin Panel Open
                    </Button>
                  </>
                ) : (
                  <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
                    Admin panel active.
                  </div>
                )}
              </CardContent>
            </Card>

            {adminOpen && (
              <Card className="rounded-3xl border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">Admin Dashboard</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-3 text-center">
                      <div className="text-xl font-bold">{pendingCount}</div>
                      <div className="text-xs text-slate-500">Pending</div>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 p-3 text-center">
                      <div className="text-xl font-bold">{approvedCount}</div>
                      <div className="text-xs text-slate-500">Approved</div>
                    </div>
                    <div className="rounded-2xl bg-rose-50 p-3 text-center">
                      <div className="text-xl font-bold">{rejectedCount}</div>
                      <div className="text-xs text-slate-500">Rejected</div>
                    </div>
                    <div className="rounded-2xl bg-amber-50 p-3 text-center">
                      <div className="text-xl font-bold">{waitlistedCount}</div>
                      <div className="text-xs text-slate-500">Waitlisted</div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Select
                      value={adminFilter}
                      onValueChange={(value) => setAdminFilter(value as StatusType | "all")}
                    >
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue placeholder="Status filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">সব status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="waitlisted">Waitlisted</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={adminRouteFilter}
                      onValueChange={(value) => setAdminRouteFilter(value as RouteType | "all")}
                    >
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue placeholder="Route filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">সব route</SelectItem>
                        <SelectItem value="oxygen">চট্টগ্রাম অক্সিজেন</SelectItem>
                        <SelectItem value="khagrachhari">খাগড়াছড়ি</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                    {adminApplications.map((item) => (
                      <div key={item.id} className="rounded-2xl border p-4 text-sm text-slate-700">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="font-semibold">{item.name}</div>
                          <Badge className={`rounded-full ${statusClass(item.status)}`}>
                            {statusBadgeText(item.status)}
                          </Badge>
                        </div>

                        <div className="space-y-1">
                          <div><span className="font-medium">Ticket ID:</span> {item.ticketId}</div>
                          <div><span className="font-medium">Phone:</span> {item.phone}</div>
                          <div><span className="font-medium">Route:</span> {ROUTES[item.route].title}</div>
                          <div><span className="font-medium">Seat:</span> {item.seat}</div>
                          <div>
                            <span className="font-medium">Applied At:</span> {new Date(item.createdAt).toLocaleString()}
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <Button
                            className="rounded-2xl"
                            disabled={adminBusyId === item.id || item.status === "approved"}
                            onClick={() => updateStatus(item, "approved")}
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-2xl"
                            disabled={adminBusyId === item.id || item.status === "waitlisted"}
                            onClick={() => updateStatus(item, "waitlisted")}
                          >
                            <Clock3 className="mr-1 h-4 w-4" /> Waitlist
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-2xl"
                            disabled={adminBusyId === item.id || item.status === "rejected"}
                            onClick={() => updateStatus(item, "rejected")}
                          >
                            <XCircle className="mr-1 h-4 w-4" /> Reject
                          </Button>
                        </div>
                      </div>
                    ))}

                    {adminApplications.length === 0 && (
                      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                        কোনো data পাওয়া যায়নি।
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">📌 গুরুত্বপূর্ণ নির্দেশনা</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                
  <ol>
  <li>Approved সিটে আর আবেদন করা যাবে না</li>
  <li>Pending সিটে একাধিক আবেদন করা যাবে</li>
  <li>আগে আবেদনকারীদের অগ্রাধিকার দেওয়া হবে</li>
  <li>যোগাযোগ না হলে পরবর্তী আবেদনকারীর সাথে যোগাযোগ করা হবে</li>
  <li>Approved হলে SMS/কলের মাধ্যমে জানানো হবে</li>
   <li> for detail call-01643097477(Tasfique)</li>
</ol>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
