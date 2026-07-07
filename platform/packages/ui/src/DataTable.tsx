import React from "react";

export interface DataTableProps {
  headers: string[];
  children: React.ReactNode;
  className?: string;
}

export function DataTable({ headers, children, className = "" }: DataTableProps) {
  const wrapperClasses = ["card overflow-x-auto", className].filter(Boolean).join(" ");
  return (
    <div className={wrapperClasses}>
      <table className="data-table" role="table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="mono"
                style={{ textTransform: "uppercase" }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
