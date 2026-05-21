import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  style?: StyleProp<ViewStyle | TextStyle>;
  allowClear?: boolean;
};

type CalendarDay = {
  key: string;
  label: string;
  value: string;
  inMonth: boolean;
};

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateParts(year: number, monthIndex: number, day: number) {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function parseDateString(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(year, monthIndex, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== monthIndex || date.getUTCDate() !== day) {
    return null;
  }

  return { year, monthIndex, day };
}

function shiftMonth(year: number, monthIndex: number, delta: number) {
  const next = new Date(Date.UTC(year, monthIndex + delta, 1));
  return {
    year: next.getUTCFullYear(),
    monthIndex: next.getUTCMonth(),
  };
}

function buildCalendarDays(year: number, monthIndex: number) {
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const firstWeekday = firstDay.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const daysInPreviousMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const days: CalendarDay[] = [];

  for (let index = 0; index < 42; index += 1) {
    const calendarDay = index - firstWeekday + 1;

    if (calendarDay < 1) {
      const previous = shiftMonth(year, monthIndex, -1);
      const day = daysInPreviousMonth + calendarDay;
      days.push({
        key: `${previous.year}-${previous.monthIndex}-${day}`,
        label: String(day),
        value: formatDateParts(previous.year, previous.monthIndex, day),
        inMonth: false,
      });
      continue;
    }

    if (calendarDay > daysInMonth) {
      const next = shiftMonth(year, monthIndex, 1);
      const day = calendarDay - daysInMonth;
      days.push({
        key: `${next.year}-${next.monthIndex}-${day}`,
        label: String(day),
        value: formatDateParts(next.year, next.monthIndex, day),
        inMonth: false,
      });
      continue;
    }

    days.push({
      key: `${year}-${monthIndex}-${calendarDay}`,
      label: String(calendarDay),
      value: formatDateParts(year, monthIndex, calendarDay),
      inMonth: true,
    });
  }

  return days;
}

export function DateField({ value, onChange, placeholder, style, allowClear = false }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => {
    const now = new Date();
    return formatDateParts(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const parsedValue = useMemo(() => parseDateString(value), [value]);
  const initialMonth =
    parsedValue ?? parseDateString(today) ?? { year: new Date().getFullYear(), monthIndex: new Date().getMonth(), day: 1 };
  const [visibleMonth, setVisibleMonth] = useState({
    year: initialMonth.year,
    monthIndex: initialMonth.monthIndex,
  });

  const openPicker = () => {
    const nextMonth = parsedValue ?? parseDateString(today);
    if (nextMonth) {
      setVisibleMonth({ year: nextMonth.year, monthIndex: nextMonth.monthIndex });
    }
    setOpen(true);
  };

  const calendarDays = useMemo(
    () => buildCalendarDays(visibleMonth.year, visibleMonth.monthIndex),
    [visibleMonth.monthIndex, visibleMonth.year],
  );

  return (
    <>
      <Pressable onPress={openPicker} style={[styles.input, styles.buttonInput, style]}>
        <Text style={value ? styles.valueText : styles.placeholderText}>{value || placeholder}</Text>
      </Pressable>
      <Modal animationType="fade" transparent visible={open} onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{placeholder}</Text>
              <Pressable
                onPress={() => {
                  const previous = shiftMonth(visibleMonth.year, visibleMonth.monthIndex, -1);
                  setVisibleMonth(previous);
                }}
                style={styles.navButton}
              >
                <Text style={styles.navText}>{"<"}</Text>
              </Pressable>
              <Text style={styles.monthLabel}>
                {MONTH_LABELS[visibleMonth.monthIndex]} {visibleMonth.year}
              </Text>
              <Pressable
                onPress={() => {
                  const next = shiftMonth(visibleMonth.year, visibleMonth.monthIndex, 1);
                  setVisibleMonth(next);
                }}
                style={styles.navButton}
              >
                <Text style={styles.navText}>{">"}</Text>
              </Pressable>
            </View>

            <View style={styles.weekdays}>
              {WEEKDAY_LABELS.map((label) => (
                <Text key={label} style={styles.weekdayText}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {calendarDays.map((day) => {
                const isSelected = day.value === value;
                const isToday = day.value === today;
                return (
                  <Pressable
                    key={day.key}
                    onPress={() => {
                      onChange(day.value);
                      setOpen(false);
                    }}
                    style={[styles.dayCell, isSelected && styles.dayCellSelected, isToday && !isSelected && styles.dayCellToday]}
                  >
                    <Text style={[styles.dayText, !day.inMonth && styles.dayTextMuted, isSelected && styles.dayTextSelected]}>
                      {day.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.footer}>
              {allowClear ? (
                <Pressable
                  onPress={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  style={[styles.footerButton, styles.footerButtonGhost]}
                >
                  <Text style={styles.footerGhostText}>Clear</Text>
                </Pressable>
              ) : (
                <View />
              )}
              <Pressable onPress={() => setOpen(false)} style={styles.footerButton}>
                <Text style={styles.footerButtonText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: "#FFFDF9",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#2F241B",
    flex: 1,
    borderWidth: 1,
    borderColor: "#E6D4C4",
  },
  buttonInput: {
    justifyContent: "center",
    minHeight: 48,
  },
  valueText: {
    color: "#2F241B",
  },
  placeholderText: {
    color: "#A38C77",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(90, 64, 42, 0.28)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFF9F3",
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  header: {
    gap: 8,
  },
  headerTitle: {
    color: "#9C5C24",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  monthLabel: {
    color: "#2F241B",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  navButton: {
    position: "absolute",
    top: 22,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7E7D8",
    borderWidth: 1,
    borderColor: "#E6D4C4",
  },
  navText: {
    color: "#6A4B34",
    fontSize: 18,
    fontWeight: "700",
  },
  weekdays: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekdayText: {
    flex: 1,
    textAlign: "center",
    color: "#8A745E",
    fontSize: 12,
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.2857%",
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFDF9",
    borderWidth: 2,
    borderColor: "#FFF9F3",
  },
  dayCellSelected: {
    backgroundColor: "#CFE9D5",
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: "#B7814E",
  },
  dayText: {
    color: "#2F241B",
    fontWeight: "700",
  },
  dayTextMuted: {
    color: "#B7A28E",
  },
  dayTextSelected: {
    color: "#215733",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerButton: {
    minWidth: 96,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#D9F3DF",
    borderWidth: 1,
    borderColor: "#B7D1BD",
  },
  footerButtonGhost: {
    backgroundColor: "#F4E5D6",
  },
  footerButtonText: {
    color: "#215733",
    fontWeight: "800",
  },
  footerGhostText: {
    color: "#8A5A30",
    fontWeight: "800",
  },
});
