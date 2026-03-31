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
  Clock3,
  LayoutDashboard,
  CheckCircle2,
  XCircle,
  LocateFixed,
  Flag,
  ArrowLeft,
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
  rejectionNote?: string;
  travelUpdate?: TravelUpdateType;
  travelUpdatedAt?: string;
};

const ADMIN_PASSCODE = "rmstu-admin-2026";
const UNITS: UnitType[] = ["A Unit", "B Unit", "C Unit"];
const ALL_SEATS = [
  "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10",
  "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10",
  "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10",
  "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10",
  "E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9", "E10",
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10",
  "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9", "G10",
  "H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8", "H9", "H10",
  "I1", "I2", "I3", "I4", "I5", "I6", "I7", "I8", "I9", "I10",
  "J1", "J2", "J3", "J4", "J5", "J6", "J7", "J8", "J9", "J10",
];

export default function AdminPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [message, setMessage] = useState("");

  const [adminPasscode, setAdminPasscode] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminFilter, setAdminFilter] = useState<StatusType | "all">("pending");
  const [adminBusyId, setAdminBusyId] = useState("");
  const [adminUnitFilter, setAdminUnitFilter] = useState<UnitType | "all">("all");
  const [adminSeatSearch, setAdminSeatSearch] = useState("");
  const [adminSeatAssignments, setAdminSeatAssignments] = useState<Record<string, string>>({});
  const [adminRejectNotes, setAdminRejectNotes] = useState<Record<string, string>>({});
  const [adminEditingRejectedId, setAdminEditingRejectedId] = useState<string | null>(null);
  const [adminUpdatedRejectionNotes, setAdminUpdatedRejectionNotes] = useState<Record<string, string>>({});

  const loadApplications = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const snapshot = await getDocs(collection(db, "applications"));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Application));
      setApplications(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setMessage("Data refresh হয়েছে।");
    } catch (error) {
      console.error(error);
      setMessage("Data load হয়নি।");
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const handleAdminLogin = () => {
    if (adminPasscode === ADMIN_PASSCODE) {
      setAdminOpen(true);
      setMessage("Admin panel open হয়েছে।");
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
          where("seat", "==", application.seat),
          where("unit", "==", application.unit),
          where("status", "==", "approved")
        );
        const approvedSeatSnapshot = await getDocs(approvedSeatQuery);

        const hasOtherApproved = approvedSeatSnapshot.docs.some(
          (docItem) => docItem.id !== application.id
        );

        if (hasOtherApproved) {
          setMessage("এই ইউনিটের এই সিটে ইতোমধ্যে ওয়েটিং লিস্টে আপনার আগে থাকা একজন প্রার্থী এপ্রুভ হয়েছেন। আমার নিজেদের ও ইচ্ছে হইতেছে সবাইকে নিয়ে যাওয়ার কিন্তু আমাদের লিমিটেশনের জন্য আমরা আন্তরিক ভাবে ক্ষমা প্রার্থী।");
          setAdminBusyId("");
          return;
        }
      }

      const payload: Partial<Application> = {
        status: nextStatus,
      };

      if (nextStatus !== "rejected") {
        payload.rejectionNote = undefined;
      }

      await updateDoc(doc(db, "applications", application.id), payload);

      if (nextStatus === "approved") {
        const sameSeatPendingSameUnit = applications.filter(
          (item) =>
            item.id !== application.id &&
            item.seat === application.seat &&
            item.unit === application.unit &&
            item.status === "pending"
        );

        for (const item of sameSeatPendingSameUnit) {
          if (item.id) {
            await updateDoc(doc(db, "applications", item.id), {
              status: "rejected",
              rejectionNote: "এই সিটে অন্য একজন আবেদনকারী approved হয়েছেন।",
            });
          }
        }
      }

      setMessage("Status update সফল হয়েছে।");
      await loadApplications();
    } catch (error) {
      console.error(error);
      setMessage("Status update করা যায়নি।");
    } finally {
      setAdminBusyId("");
    }
  };

  const rejectWithNote = async (application: Application) => {
    if (!application.id) return;

    const note = (adminRejectNotes[application.id] || "").trim();

    if (!note) {
      setMessage("Reject করার আগে একটি note/reason লিখুন।");
      return;
    }

    setAdminBusyId(application.id);
    setMessage("");

    try {
      await updateDoc(doc(db, "applications", application.id), {
        status: "rejected",
        rejectionNote: note,
      });

      setAdminRejectNotes((prev) => ({ ...prev, [application.id as string]: "" }));
      setMessage("Applicant rejected করা হয়েছে এবং note save হয়েছে।");
      await loadApplications();
    } catch (error) {
      console.error(error);
      setMessage("Reject note save করা যায়নি।");
    } finally {
      setAdminBusyId("");
    }
  };

  const updateRejectionNote = async (application: Application) => {
    if (!application.id) return;

    const updatedNote = (adminUpdatedRejectionNotes[application.id] || "").trim();

    if (!updatedNote) {
      setMessage("আপডেট করার আগে কারণ লিখুন।");
      return;
    }

    setAdminBusyId(application.id);
    setMessage("");

    try {
      await updateDoc(doc(db, "applications", application.id), {
        rejectionNote: updatedNote,
      });

      setAdminUpdatedRejectionNotes((prev) => ({ ...prev, [application.id as string]: "" }));
      setAdminEditingRejectedId(null);
      setMessage("রিজেকশন নোট আপডেট হয়েছে।");
      await loadApplications();
    } catch (error) {
      console.error(error);
      setMessage("নোট আপডেট করা যায়নি।");
    } finally {
      setAdminBusyId("");
    }
  };

  const assignSeatToApplicant = async (application: Application) => {
    if (!application.id) return;

    const nextSeatRaw = adminSeatAssignments[application.id] || "";
    const nextSeat = nextSeatRaw.trim().toUpperCase();

    if (!nextSeat) {
      setMessage("নতুন seat লিখুন।");
      return;
    }

    if (!ALL_SEATS.includes(nextSeat)) {
      setMessage("এই seat নামটি valid না।");
      return;
    }

    if (nextSeat === application.seat) {
      setMessage("Applicant already এই seat-এ আছে।");
      return;
    }

    setAdminBusyId(application.id);
    setMessage("");

    try {
      const approvedSeatQuery = query(
        collection(db, "applications"),
        where("seat", "==", nextSeat),
        where("unit", "==", application.unit),
        where("status", "==", "approved")
      );
      const approvedSeatSnapshot = await getDocs(approvedSeatQuery);

      // If there's someone already approved for this seat, reject them
      if (!approvedSeatSnapshot.empty) {
        const currentApprovedDoc = approvedSeatSnapshot.docs[0];
        const currentApprovedData = currentApprovedDoc.data() as Application;
        
        await updateDoc(doc(db, "applications", currentApprovedDoc.id), {
          status: "rejected",
          rejectionNote: `এই সিটে ${application.name} (${application.ticketId}) assign করা হয়েছে।`,
        });
        
        setMessage(`পূর্বের approved applicant ${currentApprovedData.name} কে rejected করে নতুন applicant কে assign করা হলো।`);
      }

      await updateDoc(doc(db, "applications", application.id), {
        seat: nextSeat,
      });

      setAdminSeatAssignments((prev) => ({ ...prev, [application.id as string]: "" }));
      setMessage(`Seat successfully ${application.seat} থেকে ${nextSeat} এ assign করা হয়েছে।`);
      await loadApplications();
    } catch (error) {
      console.error(error);
      setMessage("Seat assign করা যায়নি।");
    } finally {
      setAdminBusyId("");
    }
  };

  const updateTravelStatus = async (
    application: Application,
    nextTravelUpdate: TravelUpdateType
  ) => {
    if (!application.id) return;

    setAdminBusyId(application.id);
    setMessage("");

    try {
      await updateDoc(doc(db, "applications", application.id), {
        travelUpdate: nextTravelUpdate,
        travelUpdatedAt: new Date().toISOString(),
      });

      setMessage("Travel update সফল হয়েছে।");
      await loadApplications();
    } catch (error) {
      console.error(error);
      setMessage("Travel update করা যায়নি।");
    } finally {
      setAdminBusyId("");
    }
  };

  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const approvedCount = applications.filter((a) => a.status === "approved").length;
  const rejectedCount = applications.filter((a) => a.status === "rejected").length;
  const waitlistedCount = applications.filter((a) => a.status === "waitlisted").length;

  const adminApplications = useMemo(() => {
    let filtered = applications;

    if (adminFilter !== "all") {
      filtered = filtered.filter((a) => a.status === adminFilter);
    }

    if (adminUnitFilter !== "all") {
      filtered = filtered.filter((a) => a.unit === adminUnitFilter);
    }

    if (adminSeatSearch.trim()) {
      const searchSeat = adminSeatSearch.trim().toUpperCase();
      filtered = filtered.filter((a) => a.seat.includes(searchSeat));
    }

    return filtered;
  }, [applications, adminFilter, adminUnitFilter, adminSeatSearch]);

  const aUnitCount = applications.filter((a) => a.unit === "A Unit").length;
  const bUnitCount = applications.filter((a) => a.unit === "B Unit").length;
  const cUnitCount = applications.filter((a) => a.unit === "C Unit").length;

  const aUnitWaiting = applications.filter((a) => a.unit === "A Unit" && a.status === "waitlisted").length;
  const bUnitWaiting = applications.filter((a) => a.unit === "B Unit" && a.status === "waitlisted").length;
  const cUnitWaiting = applications.filter((a) => a.unit === "C Unit" && a.status === "waitlisted").length;

  const aUnitApproved = applications.filter((a) => a.unit === "A Unit" && a.status === "approved").length;
  const bUnitApproved = applications.filter((a) => a.unit === "B Unit" && a.status === "approved").length;
  const cUnitApproved = applications.filter((a) => a.unit === "C Unit" && a.status === "approved").length;

  const statusClass = (status: StatusType) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "waitlisted":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const statusBadgeText = (status: StatusType) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "approved":
        return "Approved";
      case "rejected":
        return "Rejected";
      case "waitlisted":
        return "Waitlisted";
    }
  };

  const travelUpdateClass = (update?: TravelUpdateType) => {
    switch (update) {
      case "departing":
        return "bg-sky-100 text-sky-800";
      case "arriving":
        return "bg-violet-100 text-violet-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const travelUpdateText = (update?: TravelUpdateType) => {
    switch (update) {
      case "departing":
        return "Departing";
      case "arriving":
        return "Arrived";
      default:
        return "Not updated";
    }
  };

  const formatDateTime = (dateTimeStr?: string) => {
    if (!dateTimeStr) return "No update";
    try {
      return new Date(dateTimeStr).toLocaleString();
    } catch {
      return "Invalid date";
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f3fbf5_0%,#ffffff_60%,#fff7f7_100%)] px-3 py-4 sm:px-4 md:px-6">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-green-800">Admin Panel</h1>
          <a href="/" className="inline-flex items-center gap-2 rounded-2xl border border-green-200 bg-white px-4 py-2 text-green-800 hover:bg-green-50">
            <ArrowLeft className="h-4 w-4" />
            Home
          </a>
        </div>

        {message && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {message}
          </div>
        )}

        <Card className="rounded-[28px] border border-green-100 bg-white shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-green-800 sm:text-xl">
              <LayoutDashboard className="h-5 w-5 text-red-600" /> Admin Access (Only for organizers)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!adminOpen ? (
              <>
                <Input
                  className="h-11 rounded-2xl border-green-200 text-base focus-visible:ring-green-500"
                  type="password"
                  placeholder="Admin passcode"
                  value={adminPasscode}
                  onChange={(e) => setAdminPasscode(e.target.value)}
                />
                <Button
                  className="h-11 w-full rounded-2xl bg-green-700 text-base text-white hover:bg-green-800"
                  onClick={handleAdminLogin}
                >
                  Admin Panel Open
                </Button>
              </>
            ) : (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                Admin panel active.
              </div>
            )}
          </CardContent>
        </Card>

        {adminOpen && (
          <Card className="rounded-[28px] border border-green-100 bg-white shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-green-800 sm:text-xl">
                Admin Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-green-100 bg-green-50 p-3 text-center">
                  <div className="text-lg font-bold text-green-800 sm:text-xl">{pendingCount}</div>
                  <div className="text-xs text-slate-600">Pending</div>
                </div>
                <div className="rounded-2xl border border-green-100 bg-green-100 p-3 text-center">
                  <div className="text-lg font-bold text-green-800 sm:text-xl">{approvedCount}</div>
                  <div className="text-xs text-slate-600">Approved</div>
                </div>
                <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-center">
                  <div className="text-lg font-bold text-red-700 sm:text-xl">{rejectedCount}</div>
                  <div className="text-xs text-slate-600">Rejected</div>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-center">
                  <div className="text-lg font-bold text-amber-700 sm:text-xl">{waitlistedCount}</div>
                  <div className="text-xs text-slate-600">Waitlisted</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-green-100 bg-white p-3 text-center">
                  <div className="text-lg font-bold text-green-800">{aUnitCount}</div>
                  <div className="text-xs text-slate-600">A Unit</div>
                  <div className="mt-1 text-[11px] text-amber-700">W: {aUnitWaiting}</div>
                  <div className="text-[11px] text-green-700">A: {aUnitApproved}</div>
                </div>
                <div className="rounded-2xl border border-green-100 bg-white p-3 text-center">
                  <div className="text-lg font-bold text-green-800">{bUnitCount}</div>
                  <div className="text-xs text-slate-600">B Unit</div>
                  <div className="mt-1 text-[11px] text-amber-700">W: {bUnitWaiting}</div>
                  <div className="text-[11px] text-green-700">A: {bUnitApproved}</div>
                </div>
                <div className="rounded-2xl border border-green-100 bg-white p-3 text-center">
                  <div className="text-lg font-bold text-green-800">{cUnitCount}</div>
                  <div className="text-xs text-slate-600">C Unit</div>
                  <div className="mt-1 text-[11px] text-amber-700">W: {cUnitWaiting}</div>
                  <div className="text-[11px] text-green-700">A: {cUnitApproved}</div>
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl border border-green-100 bg-green-50/60 p-4">
                <div className="text-sm font-semibold text-green-900">
                  ইউনিট ও সিট দিয়ে সার্চ করুন
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-green-900">Unit filter</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAdminUnitFilter("all")}
                        className={`rounded-xl border px-3 py-2 text-sm ${
                          adminUnitFilter === "all"
                            ? "bg-red-600 text-white border-red-600"
                            : "bg-white text-green-800 border-green-200"
                        }`}
                      >
                        All
                      </button>
                      {UNITS.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setAdminUnitFilter(item)}
                          className={`rounded-xl border px-3 py-2 text-sm ${
                            adminUnitFilter === item
                              ? "bg-red-600 text-white border-red-600"
                              : "bg-white text-green-800 border-green-200"
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-green-900">Seat search</Label>
                    <Input
                      value={adminSeatSearch}
                      onChange={(e) => setAdminSeatSearch(e.target.value)}
                      placeholder="যেমন A1 / H4 / J2"
                      className="h-11 rounded-2xl border-green-200 text-base focus-visible:ring-green-500"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge className="w-fit rounded-full border border-green-200 bg-white px-3 py-1 text-green-800">
                    Status: {adminFilter}
                  </Badge>
                  <Badge className="w-fit rounded-full border border-green-200 bg-white px-3 py-1 text-green-800">
                    Unit: {adminUnitFilter}
                  </Badge>
                  <Badge className="w-fit rounded-full border border-green-200 bg-white px-3 py-1 text-green-800">
                    Seat: {adminSeatSearch.trim() || "all"}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(["all", "pending", "approved", "rejected", "waitlisted"] as const).map(
                    (status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setAdminFilter(status)}
                        className={`rounded-full px-3 py-2 text-sm ${
                          adminFilter === status
                            ? "bg-red-600 text-white"
                            : "border border-green-200 bg-white text-green-800"
                        }`}
                      >
                        {status}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {adminApplications.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-green-100 bg-white p-4 text-sm text-slate-700 shadow-sm"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="font-semibold text-green-900">{item.name}</div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={`rounded-full ${statusClass(item.status)}`}>
                          {statusBadgeText(item.status)}
                        </Badge>
                        <Badge className={`rounded-full ${travelUpdateClass(item.travelUpdate)}`}>
                          {travelUpdateText(item.travelUpdate)}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-1 leading-6">
                      <div>
                        <span className="font-medium">Ticket ID:</span> {item.ticketId}
                      </div>
                      <div>
                        <span className="font-medium">Phone:</span> {item.phone}
                      </div>
                      <div>
                        <span className="font-medium">Unit:</span> {item.unit}
                      </div>
                      <div>
                        <span className="font-medium">Seat:</span> {item.seat}
                      </div>
                      <div>
                        <span className="font-medium">Applied At:</span>{" "}
                        {new Date(item.createdAt).toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium">Travel Update Time:</span>{" "}
                        {formatDateTime(item.travelUpdatedAt)}
                      </div>
                      {item.status === "rejected" && (
                        <div className="mt-3 space-y-2">
                          {adminEditingRejectedId === item.id ? (
                            <div className="rounded-2xl border border-red-300 bg-red-100 p-3">
                              <div className="mb-2 text-sm font-semibold text-red-800">
                                {item.rejectionNote ? "রিজেকশন নোট এডিট করুন" : "রিজেকশন নোট যোগ করুন"}
                              </div>
                              <Input
                                value={adminUpdatedRejectionNotes[item.id] || item.rejectionNote || ""}
                                onChange={(e) =>
                                  setAdminUpdatedRejectionNotes((prev) => ({
                                    ...prev,
                                    [item.id || ""]: e.target.value,
                                  }))
                                }
                                placeholder="রিজেকশনের কারণ লিখুন"
                                className="mb-2 h-11 rounded-2xl border-red-200 bg-white"
                              />
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  className="flex-1 rounded-2xl bg-red-600 text-white hover:bg-red-700"
                                  disabled={adminBusyId === item.id}
                                  onClick={() => updateRejectionNote(item)}
                                >
                                  সেভ করুন
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="flex-1 rounded-2xl border-red-300 text-red-700 hover:bg-red-50"
                                  disabled={adminBusyId === item.id}
                                  onClick={() => {
                                    setAdminEditingRejectedId(null);
                                    setAdminUpdatedRejectionNotes((prev) => ({
                                      ...prev,
                                      [item.id || ""]: "",
                                    }));
                                  }}
                                >
                                  ক্যান্সেল
                                </Button>
                              </div>
                            </div>
                          ) : item.rejectionNote ? (
                            <div className="flex items-start justify-between gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2">
                              <div className="text-red-700">
                                <span className="font-medium">Reject Note:</span> {item.rejectionNote}
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-lg border-red-300 text-red-700 hover:bg-red-100"
                                disabled={adminBusyId === item.id}
                                onClick={() => {
                                  if (item.id) {
                                    setAdminEditingRejectedId(item.id);
                                    setAdminUpdatedRejectionNotes((prev) => ({
                                      ...prev,
                                      [item.id || ""]: item.rejectionNote || "",
                                    }));
                                  }
                                }}
                              >
                                Edit
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              className="w-full rounded-2xl border border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                              disabled={adminBusyId === item.id}
                              onClick={() => {
                                if (item.id) {
                                  setAdminEditingRejectedId(item.id);
                                  setAdminUpdatedRejectionNotes((prev) => ({
                                    ...prev,
                                    [item.id || ""]: "",
                                  }));
                                }
                              }}
                            >
                              + রিজেকশন নোট যোগ করুন
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {(item.status === "pending" || item.status === "waitlisted" || item.status === "approved" || item.status === "rejected") && (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                        <div className="mb-2 text-sm font-semibold text-amber-800">
                          অন্য সিট assign করুন
                        </div>
                        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                          <Input
                            value={adminSeatAssignments[item.id || ""] || ""}
                            onChange={(e) =>
                              setAdminSeatAssignments((prev) => ({
                                ...prev,
                                [item.id || ""]: e.target.value,
                              }))
                            }
                            placeholder="নতুন seat যেমন B2"
                            className="h-11 rounded-2xl border-amber-200 bg-white"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-2xl border-amber-300 text-amber-800 hover:bg-amber-100"
                            disabled={adminBusyId === item.id}
                            onClick={() => assignSeatToApplicant(item)}
                          >
                            Seat Assign
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Button
                        className="rounded-2xl bg-green-700 text-white hover:bg-green-800"
                        disabled={adminBusyId === item.id || item.status === "approved"}
                        onClick={() => updateStatus(item, "approved")}
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                      </Button>

                      <Button
                        variant="outline"
                        className="rounded-2xl border-amber-300 text-amber-700 hover:bg-amber-50"
                        disabled={adminBusyId === item.id || item.status === "waitlisted"}
                        onClick={() => updateStatus(item, "waitlisted")}
                      >
                        <Clock3 className="mr-1 h-4 w-4" /> Waitlist
                      </Button>

                      <Button
                        variant="outline"
                        className="rounded-2xl border-red-300 text-red-700 hover:bg-red-50"
                        disabled={adminBusyId === item.id || item.status === "rejected"}
                        onClick={() => rejectWithNote(item)}
                      >
                        <XCircle className="mr-1 h-4 w-4" /> Reject with Note
                      </Button>
                    </div>

                    {item.status !== "approved" && (
                      <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3">
                        <div className="mb-2 text-sm font-semibold text-red-800">
                          Reject note
                        </div>
                        <Input
                          value={adminRejectNotes[item.id || ""] || ""}
                          onChange={(e) =>
                            setAdminRejectNotes((prev) => ({
                              ...prev,
                              [item.id || ""]: e.target.value,
                            }))
                          }
                          placeholder="Reject করার কারণ লিখুন"
                          className="h-11 rounded-2xl border-red-200 bg-white"
                        />
                      </div>
                    )}

                    {item.status === "approved" && (
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button
                          variant="outline"
                          className="rounded-2xl border-sky-300 text-sky-700 hover:bg-sky-50"
                          disabled={adminBusyId === item.id}
                          onClick={() => updateTravelStatus(item, "departing")}
                        >
                          <LocateFixed className="mr-1 h-4 w-4" /> Mark Departing
                        </Button>

                        <Button
                          variant="outline"
                          className="rounded-2xl border-violet-300 text-violet-700 hover:bg-violet-50"
                          disabled={adminBusyId === item.id}
                          onClick={() => updateTravelStatus(item, "arriving")}
                        >
                          <Flag className="mr-1 h-4 w-4" /> Mark Arriving
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {adminApplications.length === 0 && (
                  <div className="rounded-2xl border border-green-100 bg-green-50 p-4 text-sm text-slate-600">
                    কোনো data পাওয়া যায়নি।
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
