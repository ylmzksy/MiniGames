// levels/daily_01.js
registerLevel({
    id: 1,
    name: "Turkish Grid Day 1",
    // Column definitions (horizontal parameters)
    columns: [
        { labelKey: "col_6_letters", type: "6_LETTERS_OR_FEWER" },
        { labelKey: "col_no_cgi", type: "DOES_NOT_CONTAIN", params: ["c", "g", "ı"] },
        { labelKey: "col_no_ir", type: "DOES_NOT_CONTAIN", params: ["i", "r"] }
    ],
    // Row definitions (vertical parameters)
    rows: [
        { labelKey: "row_contains_ep", type: "CONTAINS", params: "ep" },
        { labelKey: "row_ends_p", type: "ENDS_WITH", params: "p" },
        { labelKey: "row_ends_us", type: "ENDS_WITH", params: "us" }
    ]
});