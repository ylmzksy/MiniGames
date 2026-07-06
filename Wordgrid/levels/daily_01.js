registerLevel({
    id: 'daily_01',
    columns: [
        { type: '6_LETTERS_OR_FEWER', params: null, labelKey: 'col_6_letters' },
        { type: 'DOES_NOT_CONTAIN', params: ['c', 'g', 'ı'], labelKey: 'col_no_cgi' },
        { type: 'DOES_NOT_CONTAIN', params: ['i', 'r'], labelKey: 'col_no_ir' }
    ],
    rows: [
        { type: 'CONTAINS', params: 'ep', labelKey: 'row_contains_ep' },
        { type: 'ENDS_WITH', params: 'p', labelKey: 'row_ends_p' },
        { type: 'ENDS_WITH', params: 'us', labelKey: 'row_ends_us' }
    ]
});