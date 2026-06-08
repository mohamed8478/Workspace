package com.cmpe.workspace.service.impl;

import com.cmpe.workspace.entity.Meeting;
import com.cmpe.workspace.entity.User;
import com.cmpe.workspace.ws.dto.responce.MeetingReportResponse;
import com.cmpe.workspace.ws.dto.responce.ParticipantMeetingSummary;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MeetingReportEmailService {

    private static final Logger log = LoggerFactory.getLogger(MeetingReportEmailService.class);
    private static final DateTimeFormatter EMAIL_DATE_FORMAT =
            DateTimeFormatter.ofPattern("EEE, MMM d, yyyy 'at' HH:mm");

    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${app.mail.from:no-reply@workspace.local}")
    private String mailFrom;

    @Value("${app.mail.reply-to:}")
    private String replyTo;

    @Value("${app.mail.report-to:}")
    private String reportTo;

    public boolean sendMeetingReport(
            Meeting meeting,
            List<User> recipients,
            MeetingReportResponse report
    ) {
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.warn("Meeting report email skipped because JavaMailSender is not configured");
            return false;
        }

        List<User> validRecipients = resolveRecipients(recipients).stream()
                .filter(user -> user.getEmail() != null && !user.getEmail().isBlank())
                .toList();

        if (validRecipients.isEmpty()) {
            log.warn("Meeting report email skipped for meeting {} because there are no participant emails", meeting.getId());
            return false;
        }

        boolean allSent = true;
        for (User recipient : validRecipients) {
            try {
                MimeMessage message = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
                helper.setTo(recipient.getEmail());
                helper.setFrom(mailFrom);
                if (replyTo != null && !replyTo.isBlank()) {
                    helper.setReplyTo(replyTo);
                }
                helper.setSubject("Meeting notes: " + safeTitle(meeting));
                helper.setText(
                        buildPlainTextEmail(meeting, recipient, validRecipients, report),
                        buildHtmlEmail(meeting, recipient, validRecipients, report)
                );

                mailSender.send(message);
            } catch (Exception e) {
                allSent = false;
                log.error("Failed to send meeting report for meeting {} to {}", meeting.getId(), recipient.getEmail(), e);
            }
        }

        return allSent;
    }

    private List<User> resolveRecipients(List<User> participants) {
        if (reportTo == null || reportTo.isBlank()) {
            return participants;
        }

        User fixedRecipient = new User();
        fixedRecipient.setEmail(reportTo.trim());
        fixedRecipient.setFullName("Meeting report recipient");

        return List.of(fixedRecipient);
    }

    private String buildPlainTextEmail(
            Meeting meeting,
            User recipient,
            List<User> participants,
            MeetingReportResponse report
    ) {
        ParticipantMeetingSummary personalSummary = report.summaryFor(recipient);
        String participantNames = participants.stream()
                .map(this::displayName)
                .collect(Collectors.joining(", "));

        return """
                Hi %s,

                Here are the notes from "%s".

                Meeting details
                Date: %s
                Participants: %s

                Meeting recap
                %s

                Your contribution
                %s

                Participant highlights
                %s

                Generated automatically from the meeting transcript.
                """.formatted(
                displayName(recipient),
                safeTitle(meeting),
                formatMeetingDate(meeting),
                participantNames,
                report.meetingSummary(),
                personalSummary == null ? "- No personalized summary is available." : personalSummary.summary(),
                formatParticipantSummariesPlain(report.participantSummaries())
        );
    }

    private String buildHtmlEmail(
            Meeting meeting,
            User recipient,
            List<User> participants,
            MeetingReportResponse report
    ) {
        ParticipantMeetingSummary personalSummary = report.summaryFor(recipient);
        String participantNames = participants.stream()
                .map(this::displayName)
                .collect(Collectors.joining(", "));

        return """
                <!doctype html>
                <html>
                <body style="margin:0;background:#f6f7fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1f2330;">
                  <div style="max-width:720px;margin:0 auto;padding:28px 18px;">
                    <div style="background:#ffffff;border:1px solid #e6e8f0;border-radius:28px;overflow:hidden;box-shadow:0 20px 60px rgba(31,35,48,.08);">
                      <div style="padding:28px 30px;background:linear-gradient(135deg,#f8f9ff,#eef2ff);border-bottom:1px solid #e6e8f0;">
                        <div style="font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#635bff;">Meeting notes</div>
                        <h1 style="margin:10px 0 8px;font-size:30px;line-height:1.1;color:#151923;">%s</h1>
                        <p style="margin:0;color:#667085;font-size:14px;">%s</p>
                      </div>

                      <div style="padding:24px 30px;">
                        <div style="display:block;padding:16px 18px;border-radius:18px;background:#f8fafc;border:1px solid #edf0f5;margin-bottom:22px;">
                          <p style="margin:0 0 8px;color:#667085;font-size:13px;"><strong style="color:#343a46;">Date:</strong> %s</p>
                          <p style="margin:0;color:#667085;font-size:13px;"><strong style="color:#343a46;">Participants:</strong> %s</p>
                        </div>

                        <h2 style="font-size:18px;margin:0 0 12px;color:#151923;">Meeting recap</h2>
                        <div style="font-size:14px;line-height:1.68;color:#343a46;margin-bottom:26px;">%s</div>

                        <div style="border:1px solid #dedbff;background:#f7f5ff;border-radius:22px;padding:18px 18px;margin-bottom:26px;">
                          <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#635bff;margin-bottom:10px;">Your contribution</div>
                          <div style="font-size:14px;line-height:1.68;color:#343a46;">%s</div>
                        </div>

                        <h2 style="font-size:18px;margin:0 0 12px;color:#151923;">Participant highlights</h2>
                        %s

                        <p style="margin:28px 0 0;color:#98a2b3;font-size:12px;text-align:center;">Generated automatically from the meeting transcript.</p>
                      </div>
                    </div>
                  </div>
                </body>
                </html>
                """.formatted(
                escape(safeTitle(meeting)),
                escape("Here are the notes from your finished meeting."),
                escape(formatMeetingDate(meeting)),
                escape(participantNames),
                markdownishToHtml(report.meetingSummary()),
                markdownishToHtml(personalSummary == null ? "- No personalized summary is available." : personalSummary.summary()),
                participantSummariesToHtml(report.participantSummaries())
        );
    }

    private String participantSummariesToHtml(List<ParticipantMeetingSummary> summaries) {
        if (summaries == null || summaries.isEmpty()) {
            return "<p style=\"color:#667085;font-size:14px;\">No participant summaries are available.</p>";
        }

        return summaries.stream()
                .map(summary -> """
                        <div style="border:1px solid #edf0f5;border-radius:18px;padding:14px 16px;margin-bottom:10px;background:#ffffff;">
                          <div style="font-weight:800;color:#151923;margin-bottom:8px;">%s</div>
                          <div style="font-size:14px;line-height:1.65;color:#343a46;">%s</div>
                        </div>
                        """.formatted(
                        escape(summary.name()),
                        markdownishToHtml(summary.summary())
                ))
                .collect(Collectors.joining());
    }

    private String formatParticipantSummariesPlain(List<ParticipantMeetingSummary> summaries) {
        if (summaries == null || summaries.isEmpty()) {
            return "- No participant summaries are available.";
        }

        return summaries.stream()
                .map(summary -> "%s\n%s".formatted(summary.name(), summary.summary()))
                .collect(Collectors.joining("\n\n"));
    }

    private String markdownishToHtml(String content) {
        if (content == null || content.isBlank()) {
            return "<p>No information available.</p>";
        }

        StringBuilder html = new StringBuilder();
        boolean inList = false;

        for (String line : content.split("\\R")) {
            String trimmed = line.trim();

            if (trimmed.isBlank()) {
                if (inList) {
                    html.append("</ul>");
                    inList = false;
                }
                continue;
            }

            if (trimmed.startsWith("- ")) {
                if (!inList) {
                    html.append("<ul style=\"margin:0 0 14px 18px;padding:0;\">");
                    inList = true;
                }
                html.append("<li style=\"margin:0 0 7px;padding-left:2px;\">")
                        .append(escape(trimmed.substring(2)))
                        .append("</li>");
                continue;
            }

            if (inList) {
                html.append("</ul>");
                inList = false;
            }

            if (trimmed.length() <= 64 && !trimmed.endsWith(".")) {
                html.append("<h3 style=\"font-size:15px;margin:18px 0 8px;color:#151923;\">")
                        .append(escape(trimmed))
                        .append("</h3>");
            } else {
                html.append("<p style=\"margin:0 0 12px;\">")
                        .append(escape(trimmed))
                        .append("</p>");
            }
        }

        if (inList) {
            html.append("</ul>");
        }

        return html.toString();
    }

    private String formatMeetingDate(Meeting meeting) {
        if (meeting.getStartTime() == null) {
            return "Not specified";
        }

        return meeting.getStartTime().format(EMAIL_DATE_FORMAT);
    }

    private String safeTitle(Meeting meeting) {
        return meeting.getTitle() == null || meeting.getTitle().isBlank()
                ? "Workspace meeting"
                : meeting.getTitle().trim();
    }

    private String displayName(User user) {
        if (user.getFullName() != null && !user.getFullName().isBlank()) {
            return user.getFullName().trim();
        }

        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            return user.getEmail().trim();
        }

        return "Participant";
    }

    private String escape(String value) {
        if (value == null) {
            return "";
        }

        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
