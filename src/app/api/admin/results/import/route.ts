import { NextResponse } from "next/server";
import { assertSameOrigin, requireAdmin } from "@/lib/admin-auth";
import { replaceResults } from "@/lib/data";

export const runtime = "nodejs";

function parseCsv(input: string): string[][] {
  const delimiter = (() => {
    const firstLine = input.split(/\r?\n/, 1)[0] ?? "";
    let quotes = false;
    let commas = 0;
    let semicolons = 0;
    for (let index = 0; index < firstLine.length; index += 1) {
      if (firstLine[index] === '"') {
        if (quotes && firstLine[index + 1] === '"') index += 1;
        else quotes = !quotes;
      } else if (!quotes && firstLine[index] === ",") commas += 1;
      else if (!quotes && firstLine[index] === ";") semicolons += 1;
    }
    return semicolons > commas ? ";" : ",";
  })();
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("El archivo CSV contiene una comilla sin cerrar.");
  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }
  return rows;
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    await requireAdmin();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json({ error: "Selecciona un archivo CSV válido." }, { status: 400 });
    }
    if (file.size < 1 || file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo CSV debe pesar menos de 2 MB." }, { status: 413 });
    }
    const rows = parseCsv((await file.text()).replace(/^\uFEFF/, ""));
    const hasHeader = rows.length > 0 && !Number.isFinite(Number(rows[0][0]?.trim()));
    if (hasHeader) rows.shift();
    if (!rows.length) return NextResponse.json({ error: "El archivo no contiene resultados para importar." }, { status: 400 });
    if (rows.length > 20000) return NextResponse.json({ error: "El archivo supera el máximo de 20.000 resultados." }, { status: 413 });

    const results: Record<string, unknown>[] = [];
    for (const [index, row] of rows.entries()) {
      const position = Number(row[0]?.trim());
      const name = row[1]?.trim() ?? "";
      if (row.length < 7 || !Number.isInteger(position) || position < 1 || !name || name.length > 120 || row.some((value) => value.length > 500)) {
        return NextResponse.json({
          error: `La fila ${index + (hasHeader ? 2 : 1)} no cumple el formato. Usa Posición, Nombre, Dorsal, Distancia, Categoría, Tiempo y Ritmo.`,
        }, { status: 400 });
      }
      results.push({
        posicion: position,
        nombre: name,
        dorsal: row[2].trim(),
        distancia: row[3].trim(),
        categoria: row[4].trim(),
        tiempo: row[5].trim(),
        ritmo: row[6].trim(),
      });
    }
    await replaceResults(results);
    return NextResponse.json({ success: true, count: results.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo importar el archivo CSV.";
    const status = message === "UNAUTHORIZED" ? 401 : message.includes("origen válido") || message.includes("otro origen") ? 403 : message.startsWith("El archivo CSV") ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? "No se pudo importar el archivo CSV." : message }, { status });
  }
}
