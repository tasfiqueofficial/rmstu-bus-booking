"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bus, Search, User, Phone, MapPin, CalendarDays, Ticket, ShieldCheck, LogIn } from "lucide-react";

type UserAccount = {
  name: string;
  phone: string;
};

type RouteType = "oxygen" | "khagrachhari";

type Booking = {
  ticketId: string;
  name: string;
  phone: string;
  route: RouteType;
  seat: string;
  createdAt: string;
};

const ROUTES: Record<RouteType, { title: string; from: string; to: string; departure: string }> = {
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

const ACCOUNT_KEY = "rmstu_bus_account_v2";
const BOOKINGS_KEY = "rmstu_bus_bookings_v2";

export default function RMSTUBusBookingPage() {
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteType>("oxygen");
  const [selectedSeat, setSelectedSeat] = useState("");
  const [searchId, setSearchId] = useState("");
  const [searchResult, setSearchResult] = useState<Booking | null>(null);
  const [message, setMessage] = useState("");
  const [latestBooking, setLatestBooking] = useState<Booking | null>(null);
  const [authForm, setAuthForm] = useState({ name: "", phone: "" });

  useEffect(() => {
    const savedAccount = localStorage.getItem(ACCOUNT_KEY);
    const savedBookings = localStorage.getItem(BOOKINGS_KEY);

    if (savedAccount) {
      try {
        setAccount(JSON.parse(savedAccount) as UserAccount);
      } catch {}
    }

    if (savedBookings) {
      try {
        setBookings(JSON.parse(savedBookings) as Booking[]);
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
  }, [bookings]);

  useEffect(() => {
    if (account) {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    }
  }, [account]);

  const currentRouteInfo = ROUTES[selectedRoute];

  const bookedSeats = useMemo(() => {
    return bookings.filter((booking) => booking.route === selectedRoute).map((booking) => booking.seat);
  }, [bookings, selectedRoute]);

  const userHasBooking = useMemo(() => {
    if (!account) return false;
    return bookings.some((booking) => booking.phone === account.phone);
  }, [bookings, account]);

  const totalSeats = seatLayout.flat().filter(Boolean).length;
  const availableSeats = totalSeats - bookedSeats.length;

  const generateTicketId = () => {
    const random = Math.floor(100000 + Math.random() * 900000);
    return `RMSTU-${random}`;
  };

  const handleRegister = () => {
    setMessage("");
    const phone = authForm.phone.trim();
    const name = authForm.name.trim();

    if (!name || !phone) {
      setMessage("নাম এবং মোবাইল নম্বর দিন।");
      return;
    }

    if (!/^01\d{9}$/.test(phone)) {
      setMessage("সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন।");
      return;
    }

    setAccount({ name, phone });
    setMessage("অ্যাকাউন্ট তৈরি হয়েছে। এখন রুট ও সিট নির্বাচন করে টিকেট বুক করুন।");
  };

  const handleLogout = () => {
    setAccount(null);
    localStorage.removeItem(ACCOUNT_KEY);
    setMessage("লগআউট হয়েছে।");
  };

  const handleBooking = () => {
    setMessage("");
    setLatestBooking(null);

    if (!account) {
      setMessage("আগে মোবাইল নম্বর দিয়ে রেজিস্ট্রেশন করুন।");
      return;
    }

    if (!selectedSeat) {
      setMessage("একটি সিট নির্বাচন করুন।");
      return;
    }

    const alreadyBookedPhone = bookings.some((booking) => booking.phone === account.phone);
    if (alreadyBookedPhone) {
      setMessage("এই মোবাইল নম্বর দিয়ে ইতোমধ্যে একটি টিকেট বুক করা হয়েছে।");
      return;
    }

    const seatAlreadyBooked = bookings.some(
      (booking) => booking.route === selectedRoute && booking.seat === selectedSeat
    );
    if (seatAlreadyBooked) {
      setMessage("এই সিটটি ইতোমধ্যে বুক হয়ে গেছে। অন্য সিট নিন।");
      return;
    }

    let newTicketId = generateTicketId();
    while (bookings.some((booking) => booking.ticketId === newTicketId)) {
      newTicketId = generateTicketId();
    }

    const newBooking: Booking = {
      ticketId: newTicketId,
      name: account.name,
      phone: account.phone,
      route: selectedRoute,
      seat: selectedSeat,
      createdAt: new Date().toLocaleString(),
    };

    setBookings((prev) => [newBooking, ...prev]);
    setLatestBooking(newBooking);
    setSelectedSeat("");
    setMessage("বুকিং সফল হয়েছে। আপনার টিকেট আইডি সংরক্ষণ করুন।");
  };

  const handleSearch = () => {
    setMessage("");
    if (!searchId.trim()) {
      setSearchResult(null);
      setMessage("টিকেট আইডি লিখে সার্চ করুন।");
      return;
    }

    const found = bookings.find(
      (booking) => booking.ticketId.toLowerCase() === searchId.trim().toLowerCase()
    );

    if (!found) {
      setSearchResult(null);
      setMessage("এই টিকেট আইডি পাওয়া যায়নি।");
      return;
    }

    setSearchResult(found);
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
                <h1 className="text-2xl font-bold md:text-3xl">RMSTU GST Bus Booking</h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-200 md:text-base">
                  Rangamati Science and Technology University-তে GST admission test দিতে আসা
                  ছাত্রছাত্রীদের জন্য বাংলাদেশ জাতীয়তাবাদী ছাত্রদল, রাঙ্গামাটি বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয় শাখা-এর বিশেষ বাস বুকিং।
                  
                  
                  Devlope by Tasfique Shikder Koushik
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-white/10 p-3 text-center">
                <div className="text-xl font-bold">2</div>
                <div className="text-xs text-slate-200">মোট বাস</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 text-center">
                <div className="text-xl font-bold">{availableSeats}</div>
                <div className="text-xs text-slate-200">এই রুটে খালি সিট</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 text-center col-span-2 md:col-span-1">
                <div className="text-xl font-bold">{bookings.length}</div>
                <div className="text-xs text-slate-200">মোট বুকিং</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <LogIn className="h-5 w-5" /> রেজিস্ট্রেশন / একাউন্ট
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>নাম</Label>
                  <Input
                    className="rounded-2xl"
                    placeholder="পূর্ণ নাম লিখুন"
                    value={authForm.name}
                    onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                    disabled={!!account}
                  />
                </div>
                <div className="space-y-2">
                  <Label>মোবাইল নম্বর</Label>
                  <Input
                    className="rounded-2xl"
                    placeholder="01XXXXXXXXX"
                    value={authForm.phone}
                    onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })}
                    disabled={!!account}
                  />
                </div>
                <div className="md:col-span-2 flex gap-3">
                  {!account ? (
                    <Button className="rounded-2xl" onClick={handleRegister}>অ্যাকাউন্ট খুলুন</Button>
                  ) : (
                    <>
                      <div className="flex-1 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                        লগইন করা আছে: <span className="font-semibold">{account.name}</span> ({account.phone})
                      </div>
                      <Button variant="outline" className="rounded-2xl" onClick={handleLogout}>লগআউট</Button>
                    </>
                  )}
                </div>
                <div className="md:col-span-2 text-xs text-slate-500">
                  একটি মোবাইল নম্বর দিয়ে শুধুমাত্র একটি টিকেট বুক করা যাবে।
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">বাস রুট নির্বাচন</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {(Object.keys(ROUTES) as RouteType[]).map((routeKey) => {
                  const route = ROUTES[routeKey];
                  const active = selectedRoute === routeKey;
                  const routeBooked = bookings.filter((b) => b.route === routeKey).length;
                  const routeAvailable = totalSeats - routeBooked;
                  return (
                    <button
                      key={routeKey}
                      type="button"
                      onClick={() => {
                        setSelectedRoute(routeKey);
                        setSelectedSeat("");
                      }}
                      className={`rounded-3xl border p-5 text-left transition ${
                        active ? "border-slate-900 bg-slate-900 text-white" : "bg-white hover:shadow-md"
                      }`}
                    >
                      <div className="text-lg font-semibold">{route.title}</div>
                      <div className={`mt-2 text-sm ${active ? "text-slate-200" : "text-slate-500"}`}>
                        {route.from} → {route.to}
                      </div>
                      <div className={`mt-2 text-sm ${active ? "text-slate-200" : "text-slate-500"}`}>
                        ছাড়ার সময়: {route.departure}
                      </div>
                      <div className="mt-3">
                        <Badge className="rounded-full">খালি সিট {routeAvailable}</Badge>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">সিট নির্বাচন</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-2xl bg-slate-100 p-3 text-center text-sm font-medium">Driver</div>
                <div className="space-y-3">
                  {seatLayout.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex items-center justify-center gap-3">
                      {row.map((seat) => {
                        if (!seat) return <div key={`${rowIndex}-gap`} className="w-6" />;
                        const isBooked = bookedSeats.includes(seat);
                        const isSelected = selectedSeat === seat;
                        return (
                          <button
                            key={seat}
                            type="button"
                            disabled={isBooked || userHasBooking || !account}
                            onClick={() => setSelectedSeat(seat)}
                            className={`h-12 w-12 rounded-2xl text-sm font-semibold transition ${
                              isBooked
                                ? "cursor-not-allowed bg-rose-100 text-rose-500"
                                : isSelected
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 hover:bg-slate-200"
                            } ${(!account || userHasBooking) ? "opacity-60" : ""}`}
                          >
                            {seat}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-2"><span className="h-4 w-4 rounded bg-slate-100" /> Available</div>
                  <div className="flex items-center gap-2"><span className="h-4 w-4 rounded bg-slate-900" /> Selected</div>
                  <div className="flex items-center gap-2"><span className="h-4 w-4 rounded bg-rose-100" /> Booked</div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <span>নির্বাচিত রুট</span>
                    <span className="font-semibold">{currentRouteInfo.title}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>নির্বাচিত সিট</span>
                    <span className="font-semibold">{selectedSeat || "এখনো সিট নির্বাচন করা হয়নি"}</span>
                  </div>
                </div>

                <Button className="w-full rounded-2xl py-6 text-base" onClick={handleBooking} disabled={!account || userHasBooking}>
                  বুকিং কনফার্ম করুন
                </Button>

                {userHasBooking && (
                  <div className="rounded-2xl border bg-amber-50 p-4 text-sm text-amber-800">
                    এই মোবাইল নম্বর দিয়ে ইতোমধ্যে একটি টিকেট বুক করা হয়েছে।
                  </div>
                )}

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
                  <Search className="h-5 w-5" /> টিকেট যাচাই
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>টিকেট আইডি</Label>
                  <Input
                    className="rounded-2xl"
                    placeholder="যেমন: RMSTU-123456"
                    value={searchId}
                    onChange={(e) => setSearchId(e.target.value)}
                  />
                </div>
                <Button className="w-full rounded-2xl" onClick={handleSearch}>
                  সার্চ করুন
                </Button>

                {searchResult && (
                  <div className="rounded-3xl border p-4 text-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-semibold">টিকেট পাওয়া গেছে</span>
                      <Badge className="rounded-full">Valid</Badge>
                    </div>
                    <div className="space-y-2 text-slate-700">
                      <div><span className="font-medium">টিকেট আইডি:</span> {searchResult.ticketId}</div>
                      <div><span className="font-medium">নাম:</span> {searchResult.name}</div>
                      <div><span className="font-medium">মোবাইল:</span> {searchResult.phone}</div>
                      <div><span className="font-medium">রুট:</span> {ROUTES[searchResult.route].title}</div>
                      <div><span className="font-medium">সিট:</span> {searchResult.seat}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {latestBooking && (
              <Card className="rounded-3xl border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <ShieldCheck className="h-5 w-5" /> সদ্য বুক করা টিকেট
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-3xl border border-dashed p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm text-slate-500">Ticket ID</div>
                        <div className="text-lg font-bold">{latestBooking.ticketId}</div>
                      </div>
                      <Badge className="rounded-full">Confirmed</Badge>
                    </div>
                    <div className="space-y-3 text-sm text-slate-700">
                      <div className="flex items-center gap-2"><User className="h-4 w-4" /> {latestBooking.name}</div>
                      <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> {latestBooking.phone}</div>
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {ROUTES[latestBooking.route].title}</div>
                      <div className="flex items-center gap-2"><Bus className="h-4 w-4" /> Seat {latestBooking.seat}</div>
                      <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {latestBooking.createdAt}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">সব বুকিং</CardTitle>
              </CardHeader>
              <CardContent>
                {bookings.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">এখনো কোনো বুকিং হয়নি।</div>
                ) : (
                  <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                    {bookings.map((booking) => (
                      <div key={booking.ticketId} className="rounded-2xl border p-4 text-sm text-slate-700">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="font-semibold">{booking.name}</div>
                          <Badge className="rounded-full">{booking.seat}</Badge>
                        </div>
                        <div><span className="font-medium">Ticket ID:</span> {booking.ticketId}</div>
                        <div><span className="font-medium">Phone:</span> {booking.phone}</div>
                        <div><span className="font-medium">Route:</span> {ROUTES[booking.route].title}</div>
                        <div><span className="font-medium">Booked At:</span> {booking.createdAt}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">গুরুত্বপূর্ণ নির্দেশনা</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <p>• এখানে টিকেট কেনা লাগবে না, শুধু সিট বুকিং হবে।</p>
                <p>• দুটি বাস আছে: চট্টগ্রাম অক্সিজেন থেকে রাঙামাটি এবং খাগড়াছড়ি থেকে রাঙামাটি।</p>
                <p>• আগে মোবাইল নম্বর দিয়ে রেজিস্ট্রেশন করে একাউন্ট খুলতে হবে।</p>
                <p>• একটি মোবাইল নম্বর দিয়ে শুধুমাত্র একটি টিকেট বুক করা যাবে।</p>
                <p>• যে সিট আগে বুক হবে, সেটি সঙ্গে সঙ্গে booked দেখাবে।</p>
                <p>• আপনার টিকেট আইডি সংরক্ষণ করুন, পরে এটি দিয়ে টিকেট যাচাই করা যাবে।</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
