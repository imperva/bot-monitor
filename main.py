"""
Bot Monitor.
This program acts as a MITM between a bot and a fully fledge browser.
"""

import frida
import argparse
import psutil
import sys
import re
import time
DESCRIPTION = \
    """
    __________        __                          .__  __                
    \______   \ _____/  |_    _____   ____   ____ |__|/  |_  ___________ 
     |    |  _//  _ \   __\  /     \ /  _ \ /    \|  \   __\/  _ \_  __ \
     |    |   (  <_> )  |   |  Y Y  (  <_> )   |  \  ||  | (  <_> )  | \/
     |______  /\____/|__|   |__|_|  /\____/|___|  /__||__|  \____/|__|   
            \/                    \/            \/                       
            
    """
FRIDA_SCRIPT_LOCATION = "frida_script.js"
SCRIPTS = {}
sockets = {}
PORT_CLIENT = 0
PORT_SERVER = 0

def on_message_inner( message, data):
    """
    Display frida messages
    :return:
    """
    print("[%s] => %s" % (message, data))

def on_message(script, message, data):
    """
    Manages messages and interact with Frida session
    :return:
    """
    print("[%s] => %s" % (message, data))

    if message["type"] == "send":
        child_pid = message["payload"].get("pid", "")
        if child_pid != "":
            print("Child process ", child_pid)
            child_session = frida.attach(child_pid)
            child_script = child_session.create_script(script_content)
            child_script.on("message", on_message_inner)
            child_script.load()
            time.sleep(1)
            script.post({'type': "input", 'payload': ""})


def load_frida_script(frida_script_location):
    """
    Load the content of the Frida script
    :return:
    """
    with open(frida_script_location, "r") as script:
        content = script.read()

    content = content.replace("<PYTHON_PATH>", re.escape(sys.executable))
    content = content.replace("<MONITOR_PATH>",
                              re.escape(r"C:\Users\malwarelab\PycharmProjects\bot_monitor\bot_monitor_intercept.py"))
    return content


def run_session(pid, script_content):
    """
    Inject a script into given PID. Returns the debugging session.
    :param pid:
    :param script_content:
    :return:
    """
    session = frida.attach(pid)
    script = session.create_script(script_content)
    SCRIPTS[pid] = script
    script.on("message", lambda message, data: on_message(script, message=message, data=data))
    script.load()
    return session


def monitor_pid(pid):
    """
    MITM the communication between a process and a browser instance
    :param pid: PID of the process to monitor
    :return:
    """
    if pid.isdigit():
        pid_n = int(pid)
        parent_process = psutil.Process(pid_n)
        sessions = []
        session = run_session(pid_n, script_content)
        sessions += [session]

        for child in parent_process.children(recursive=True):
            try:
                session = run_session(child.pid, script_content)
                sessions += [session]
            except Exception as e:
                print("Impossible to attach to the following PID. ", child.pid)
        print("[!] CTRL+D on Unix CTRL+Z on Windows to detach the script ")
        sys.stdin.read()
        for session in sessions:
            session.detach()

    else:
        print("PID provided is invalid")


def main():
    """
    Process program arguments
    :return:
    """
    parser = argparse.ArgumentParser(description=DESCRIPTION)
    parser.add_argument('-p' '--pid', help='PID of the process to inject into', required=False)
    args = parser.parse_args()
    if args.p__pid:
        monitor_pid(args.p__pid)
    else:
        print("No executable or PID provided to bot monitor. Please, try again")


if __name__ == '__main__':
    script_content = load_frida_script(FRIDA_SCRIPT_LOCATION)
    main()
