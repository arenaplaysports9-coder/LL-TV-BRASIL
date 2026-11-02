Set shell = CreateObject("WScript.Shell")
script = """" & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\REINICIAR-SERVIDOR.ps1" & """"
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " & script, 0, False
