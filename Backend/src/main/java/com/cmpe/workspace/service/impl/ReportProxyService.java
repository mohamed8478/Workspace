package com.cmpe.workspace.service.impl;

import com.cmpe.workspace.ws.dto.responce.ReportAnalyticsResponse;
import com.cmpe.workspace.ws.dto.responce.ReportEntityMetricResponse;
import com.cmpe.workspace.ws.dto.responce.ReportInfoResponse;
import com.cmpe.workspace.ws.dto.responce.ReportProductMetricResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Service
@RequiredArgsConstructor
public class ReportProxyService {
    private static final Set<String> ALLOWED_REPORTS = Set.of("client", "camion");
    private static final int MAX_GRAPH_ITEMS = 8;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @Value("${app.reports.api-url:http://localhost:5000/api}")
    private String reportApiUrl;

    public List<ReportInfoResponse> getReports() {
        try {
            HttpResponse<String> response = httpClient.send(
                    HttpRequest.newBuilder(resolve("/reports")).GET().build(),
                    HttpResponse.BodyHandlers.ofString()
            );

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Report service returned " + response.statusCode());
            }

            JsonNode root = objectMapper.readTree(response.body());
            if (!root.isArray()) {
                return List.of();
            }

            List<ReportInfoResponse> reports = new ArrayList<>();
            for (JsonNode node : root) {
                reports.add(ReportInfoResponse.builder()
                        .id(text(node, "id"))
                        .label(text(node, "label"))
                        .filename(text(node, "filename"))
                        .available(node.path("available").asBoolean(false))
                        .sizeBytes(node.path("sizeBytes").isNumber() ? node.path("sizeBytes").asLong() : null)
                        .lastModified(text(node, "lastModified"))
                        .downloadUrl(text(node, "downloadUrl"))
                        .build());
            }
            return reports;
        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Report service is unavailable", e);
        }
    }

    public DownloadedReport downloadReport(String reportId) {
        String normalizedId = normalizeReportId(reportId);

        try {
            HttpResponse<byte[]> response = httpClient.send(
                    HttpRequest.newBuilder(resolve("/reports/" + encode(normalizedId) + "/download")).GET().build(),
                    HttpResponse.BodyHandlers.ofByteArray()
            );

            if (response.statusCode() == 404) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found");
            }

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not download report");
            }

            String filename = filenameFor(normalizedId);
            return new DownloadedReport(filename, response.body());
        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Report service is unavailable", e);
        }
    }

    public ReportAnalyticsResponse getAnalytics(String reportId) {
        String normalizedId = normalizeReportId(reportId);
        DownloadedReport report = downloadReport(normalizedId);
        List<Map<String, String>> rows = readFirstSheet(report.content());

        boolean camionReport = "camion".equals(normalizedId);
        String clientColumn = camionReport ? "NOMCLI" : "CT_INTITULE";
        String clientCodeColumn = camionReport ? "CODECLI" : "CT_NUM";
        String productColumn = camionReport ? "NOMPROD" : "AR_DESIGN";
        String quantityColumn = camionReport ? null : "QTE";
        String weightColumn = "POIDSNET";
        String truckColumn = "IMMAT";
        String waitingColumn = "ATTENT";
        String loadingColumn = "Temps de Chargement";

        Set<String> clients = new HashSet<>();
        Set<String> products = new HashSet<>();
        Set<String> trucks = new HashSet<>();
        Map<String, MetricAccumulator> productMetrics = new LinkedHashMap<>();
        Map<String, MetricAccumulator> clientMetrics = new LinkedHashMap<>();
        Map<String, MetricAccumulator> clientSummaryProductMetrics = new LinkedHashMap<>();
        double totalQuantity = 0;
        double totalWeight = 0;

        for (Map<String, String> row : rows) {
            String clientName = firstPresent(row, clientColumn, clientCodeColumn, "Client inconnu");
            String rawProductName = firstPresent(row, productColumn, "Produit inconnu");
            String productName = camionReport ? rawProductName : normalizeClientProduct(rawProductName);
            String truckName = firstPresent(row, truckColumn, "");
            double quantity = quantityColumn == null ? 0 : parseDouble(row.get(quantityColumn));
            double weight = parseDouble(row.get(weightColumn));
            double waitingMinutes = camionReport ? parseDurationMinutes(row.get(waitingColumn)) : 0;
            double loadingMinutes = camionReport ? parseDurationMinutes(row.get(loadingColumn)) : 0;

            if (!clientName.isBlank()) {
                clients.add(clientName);
            }
            if (!productName.isBlank()) {
                products.add(productName);
            }
            if (!truckName.isBlank()) {
                trucks.add(truckName);
            }

            totalQuantity += quantity;
            totalWeight += weight;
            if (!camionReport && isClientSummaryProduct(rawProductName)) {
                clientSummaryProductMetrics.computeIfAbsent(productName, key -> new MetricAccumulator()).add(quantity, weight, 0, 0);
            } else {
                productMetrics.computeIfAbsent(productName, key -> new MetricAccumulator()).add(quantity, weight, waitingMinutes, loadingMinutes);
            }
            clientMetrics.computeIfAbsent(clientName, key -> new MetricAccumulator()).add(quantity, weight, 0, 0);
        }

        if (!camionReport && !clientSummaryProductMetrics.isEmpty()) {
            productMetrics = clientSummaryProductMetrics;
            products = new HashSet<>(clientSummaryProductMetrics.keySet());
            totalQuantity = clientSummaryProductMetrics.values()
                    .stream()
                    .mapToDouble(metric -> metric.quantity)
                    .sum();
        }

        return ReportAnalyticsResponse.builder()
                .reportId(normalizedId)
                .title(camionReport ? "Sortie Platre par Camion" : "Sortie Platre par Client")
                .totalRows(rows.size())
                .totalClients(clients.size())
                .totalProducts(products.size())
                .totalTrucks(trucks.size())
                .totalQuantity(round(totalQuantity))
                .totalWeight(round(totalWeight))
                .productBreakdown(toProductMetrics(productMetrics, camionReport))
                .topClients(toEntityMetrics(clientMetrics))
                .build();
    }

    private List<Map<String, String>> readFirstSheet(byte[] workbookBytes) {
        Map<String, byte[]> entries = unzip(workbookBytes);
        List<String> sharedStrings = readSharedStrings(entries.get("xl/sharedStrings.xml"));
        byte[] sheetXml = firstSheetXml(entries);

        if (sheetXml == null) {
            return List.of();
        }

        try {
            Document document = parseXml(sheetXml);
            NodeList rowNodes = document.getElementsByTagNameNS("*", "row");
            List<String> headers = List.of();
            List<Map<String, String>> rows = new ArrayList<>();

            for (int rowIndex = 0; rowIndex < rowNodes.getLength(); rowIndex++) {
                Element rowElement = (Element) rowNodes.item(rowIndex);
                List<String> values = readRow(rowElement, sharedStrings);

                if (headers.isEmpty()) {
                    headers = values.stream().map(String::trim).toList();
                    continue;
                }

                Map<String, String> row = new HashMap<>();
                for (int i = 0; i < headers.size() && i < values.size(); i++) {
                    String header = headers.get(i);
                    if (!header.isBlank()) {
                        row.put(header, values.get(i).trim());
                    }
                }

                if (!row.isEmpty()) {
                    rows.add(row);
                }
            }

            return rows;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not parse Excel report", e);
        }
    }

    private Map<String, byte[]> unzip(byte[] workbookBytes) {
        Map<String, byte[]> entries = new HashMap<>();
        try (ZipInputStream zipInputStream = new ZipInputStream(new ByteArrayInputStream(workbookBytes))) {
            ZipEntry entry;
            while ((entry = zipInputStream.getNextEntry()) != null) {
                ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
                zipInputStream.transferTo(outputStream);
                entries.put(entry.getName(), outputStream.toByteArray());
            }
            return entries;
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not open Excel report", e);
        }
    }

    private List<String> readSharedStrings(byte[] sharedStringsXml) {
        if (sharedStringsXml == null) {
            return List.of();
        }

        try {
            Document document = parseXml(sharedStringsXml);
            NodeList stringNodes = document.getElementsByTagNameNS("*", "si");
            List<String> sharedStrings = new ArrayList<>();

            for (int i = 0; i < stringNodes.getLength(); i++) {
                Element stringElement = (Element) stringNodes.item(i);
                NodeList textNodes = stringElement.getElementsByTagNameNS("*", "t");
                StringBuilder builder = new StringBuilder();

                for (int j = 0; j < textNodes.getLength(); j++) {
                    builder.append(textNodes.item(j).getTextContent());
                }

                sharedStrings.add(builder.toString());
            }

            return sharedStrings;
        } catch (Exception e) {
            return List.of();
        }
    }

    private byte[] firstSheetXml(Map<String, byte[]> entries) {
        return entries.entrySet()
                .stream()
                .filter(entry -> entry.getKey().matches("xl/worksheets/sheet\\d+\\.xml"))
                .sorted(Map.Entry.comparingByKey())
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);
    }

    private List<String> readRow(Element rowElement, List<String> sharedStrings) {
        NodeList cellNodes = rowElement.getElementsByTagNameNS("*", "c");
        List<String> values = new ArrayList<>();

        for (int i = 0; i < cellNodes.getLength(); i++) {
            Element cellElement = (Element) cellNodes.item(i);
            int columnIndex = columnIndex(cellElement.getAttribute("r"));

            while (values.size() <= columnIndex) {
                values.add("");
            }

            values.set(columnIndex, readCell(cellElement, sharedStrings));
        }

        return values;
    }

    private String readCell(Element cellElement, List<String> sharedStrings) {
        String type = cellElement.getAttribute("t");
        String value = firstChildText(cellElement, "v");

        if ("s".equals(type)) {
            int index = (int) parseDouble(value);
            return index >= 0 && index < sharedStrings.size() ? sharedStrings.get(index) : "";
        }

        if ("inlineStr".equals(type)) {
            return firstChildText(cellElement, "t");
        }

        return value == null ? "" : value;
    }

    private Document parseXml(byte[] xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        return factory.newDocumentBuilder().parse(new ByteArrayInputStream(xml));
    }

    private String firstChildText(Element element, String localName) {
        NodeList nodes = element.getElementsByTagNameNS("*", localName);
        return nodes.getLength() == 0 ? "" : nodes.item(0).getTextContent();
    }

    private int columnIndex(String cellReference) {
        int result = 0;
        for (int i = 0; i < cellReference.length(); i++) {
            char character = Character.toUpperCase(cellReference.charAt(i));
            if (character < 'A' || character > 'Z') {
                break;
            }
            result = result * 26 + (character - 'A' + 1);
        }
        return Math.max(0, result - 1);
    }

    private List<ReportProductMetricResponse> toProductMetrics(Map<String, MetricAccumulator> metrics, boolean camionReport) {
        return metrics.entrySet()
                .stream()
                .sorted(productMetricComparator(camionReport))
                .limit(MAX_GRAPH_ITEMS)
                .map(entry -> ReportProductMetricResponse.builder()
                        .name(entry.getKey())
                        .salesCount(entry.getValue().salesCount)
                        .quantity(round(entry.getValue().quantity))
                        .totalWeight(round(entry.getValue().totalWeight))
                        .averageWaitingMinutes(round(entry.getValue().averageWaitingMinutes()))
                        .averageLoadingMinutes(round(entry.getValue().averageLoadingMinutes()))
                        .build())
                .toList();
    }

    private Comparator<Map.Entry<String, MetricAccumulator>> productMetricComparator(boolean camionReport) {
        if (camionReport) {
            return Comparator.<Map.Entry<String, MetricAccumulator>>comparingDouble(entry -> entry.getValue().averageLoadingMinutes()).reversed();
        }

        return Comparator.<Map.Entry<String, MetricAccumulator>>comparingDouble(entry -> entry.getValue().quantity).reversed();
    }

    private List<ReportEntityMetricResponse> toEntityMetrics(Map<String, MetricAccumulator> metrics) {
        return metrics.entrySet()
                .stream()
                .sorted(Comparator.<Map.Entry<String, MetricAccumulator>>comparingLong(entry -> entry.getValue().salesCount).reversed())
                .limit(5)
                .map(entry -> ReportEntityMetricResponse.builder()
                        .name(entry.getKey())
                        .salesCount(entry.getValue().salesCount)
                        .totalWeight(round(entry.getValue().totalWeight))
                        .build())
                .toList();
    }

    private String firstPresent(Map<String, String> row, String preferredColumn, String fallbackColumn, String defaultValue) {
        String value = row.getOrDefault(preferredColumn, "").trim();
        if (!value.isBlank()) {
            return value;
        }
        value = row.getOrDefault(fallbackColumn, "").trim();
        return value.isBlank() ? defaultValue : value;
    }

    private String firstPresent(Map<String, String> row, String preferredColumn, String defaultValue) {
        String value = row.getOrDefault(preferredColumn, "").trim();
        return value.isBlank() ? defaultValue : value;
    }

    private boolean isClientSummaryProduct(String productName) {
        return productName != null && normalizeText(productName).startsWith("QUANTITE TOTAL");
    }

    private String normalizeClientProduct(String productName) {
        String normalized = normalizeText(productName);

        if (normalized.startsWith("QUANTITE TOTAL")) {
            normalized = normalized.replaceFirst("^QUANTITE TOTAL\\s*", "");
        }

        if (normalized.contains("MORTIER")) {
            return "MORTIER";
        }
        if (normalized.contains("EXPORT")) {
            return "EXPORT";
        }
        if (normalized.contains("AGRIGYPSE") || normalized.contains("AGRI")) {
            return "AGRIGYPSE";
        }
        if (normalized.contains("DALLE")) {
            return "DALLES";
        }
        if (normalized.contains("PLATRE")) {
            return "PLATRE";
        }

        return normalized.isBlank() ? "Produit inconnu" : normalized;
    }

    private String normalizeText(String value) {
        if (value == null) {
            return "";
        }

        return value
                .trim()
                .toUpperCase()
                .replace('Â', 'A')
                .replace('À', 'A')
                .replace('Á', 'A')
                .replace('Ã', 'A')
                .replace('Ä', 'A')
                .replace('É', 'E')
                .replace('È', 'E')
                .replace('Ê', 'E')
                .replace('Ë', 'E');
    }

    private double parseDouble(String value) {
        if (value == null || value.isBlank()) {
            return 0;
        }

        try {
            double parsed = Double.parseDouble(value.trim().replace(",", "."));
            return finiteOrZero(parsed);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private double parseDurationMinutes(String value) {
        if (value == null || value.isBlank()) {
            return 0;
        }

        String trimmed = value.trim();
        if (trimmed.contains(":")) {
            String[] parts = trimmed.split(":");
            if (parts.length >= 2) {
                double hours = parseDouble(parts[0]);
                double minutes = parseDouble(parts[1]);
                double seconds = parts.length >= 3 ? parseDouble(parts[2]) : 0;
                return hours * 60 + minutes + seconds / 60;
            }
        }

        double raw = parseDouble(trimmed);
        if (raw > 0 && raw <= 1) {
            return raw * 24 * 60;
        }
        if (raw > 1000) {
            return raw / 60;
        }

        return raw;
    }

    private double round(double value) {
        if (!Double.isFinite(value)) {
            return 0;
        }

        return Math.round(value * 100.0) / 100.0;
    }

    private static double finiteOrZero(double value) {
        return Double.isFinite(value) ? value : 0;
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? null : value.asText();
    }

    private URI resolve(String path) {
        String baseUrl = reportApiUrl.endsWith("/") ? reportApiUrl.substring(0, reportApiUrl.length() - 1) : reportApiUrl;
        return URI.create(baseUrl + path);
    }

    private String normalizeReportId(String reportId) {
        String normalized = reportId == null ? "" : reportId.trim().toLowerCase();
        if (!ALLOWED_REPORTS.contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown report");
        }
        return normalized;
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String filenameFor(String reportId) {
        return "client".equals(reportId) ? "Sortie Platre par Client.xlsx" : "Sortie Platre par Camion.xlsx";
    }

    public record DownloadedReport(String filename, byte[] content) {
    }

    private static class MetricAccumulator {
        private long salesCount;
        private double quantity;
        private double totalWeight;
        private double totalWaitingMinutes;
        private double totalLoadingMinutes;

        private void add(double quantity, double totalWeight, double waitingMinutes, double loadingMinutes) {
            this.salesCount++;
            this.quantity += finiteOrZero(quantity);
            this.totalWeight += finiteOrZero(totalWeight);
            this.totalWaitingMinutes += finiteOrZero(waitingMinutes);
            this.totalLoadingMinutes += finiteOrZero(loadingMinutes);
        }

        private double averageWaitingMinutes() {
            return salesCount == 0 ? 0 : totalWaitingMinutes / salesCount;
        }

        private double averageLoadingMinutes() {
            return salesCount == 0 ? 0 : totalLoadingMinutes / salesCount;
        }
    }
}
