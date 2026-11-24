package expo.modules.smsreader

import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsReaderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SmsReader")

    AsyncFunction("getRecentSms") { limit: Int, addressFilter: String? ->
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()
      val smsList = mutableListOf<Map<String, Any>>()

      try {
        val uri = Uri.parse("content://sms/inbox")
        val projection = arrayOf("_id", "address", "body", "date")
        val safeLimit = if (limit in 1..2500) limit else 250
        val sortOrder = "date DESC"

        val selection: String?
        val selectionArgs: Array<String>?
        
        if (!addressFilter.isNullOrBlank()) {
          selection = "address LIKE ? OR body LIKE ?"
          selectionArgs = arrayOf("%$addressFilter%", "%$addressFilter%")
        } else {
          selection = null
          selectionArgs = null
        }

        var usedFallback = false
        var cursor = try {
          context.contentResolver.query(uri, projection, selection, selectionArgs, sortOrder)
        } catch (e: Exception) {
          usedFallback = true
          null
        }

        if (cursor == null) {
          usedFallback = true
          cursor = try {
            context.contentResolver.query(uri, projection, null, null, sortOrder)
          } catch (e: Exception) {
            null
          }
        }

        cursor?.use { c ->
          val addressIndex = c.getColumnIndex("address")
          val bodyIndex = c.getColumnIndex("body")
          val dateIndex = c.getColumnIndex("date")

          var count = 0
          while (c.moveToNext() && count < safeLimit) {
            val address = if (addressIndex != -1) c.getString(addressIndex) ?: "" else ""
            val body = if (bodyIndex != -1) c.getString(bodyIndex) ?: "" else ""
            val date = if (dateIndex != -1) c.getLong(dateIndex) else 0L

            if (usedFallback && !addressFilter.isNullOrBlank()) {
              val match = address.contains(addressFilter, ignoreCase = true) ||
                          body.contains(addressFilter, ignoreCase = true)
              if (!match) continue
            }

            smsList.add(mapOf(
              "address" to address,
              "body" to body,
              "date" to date
            ))
            count++
          }
        }
      } catch (e: Exception) {
        android.util.Log.e("SmsReaderModule", "Error reading SMS inbox: ${e.message}", e)
      }

      smsList
    }
  }
}
