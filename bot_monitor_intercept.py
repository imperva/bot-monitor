import socket
import subprocess
import sys
import threading
import re
import logging
import random
import os

NODE_PATH = r"node.exe"
PROXY_PATH = os.path.join(os.path.dirname(__file__), "proxy.js")
NEW_PORT = 0
logging.basicConfig(filename=os.path.join(os.path.dirname(__file__), "logs", "logging_monitor.log"), level=logging.INFO)


def get_free_port(port=1024, max_port=65535):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    while port <= max_port:
        try:
            port = random.randint(1024, max_port)
            sock.bind(('', port))
            sock.close()
            return port
        except OSError:
            port += 1

    raise IOError('No free port was found')


def stderr_handler(p, port_websocket, arguments):
    global NEW_PORT
    logging.info("Proxy port" + str(port_websocket))
    for line in p.stderr:
        if "127.0.0.1" in line.decode("utf-8").rstrip():
            NEW_PORT = int(line.decode("utf-8").rstrip().split("127.0.0.1:")[-1].split("/")[0])
            logging.info("Chrome PORT = " + str(NEW_PORT))
            subprocess.Popen([NODE_PATH, PROXY_PATH, str(port_websocket), str(NEW_PORT), str(p.pid)], creationflags=subprocess.DETACHED_PROCESS, shell=True)

            ## Replacing the remote-debugging-port from the stderr
            line = re.sub(r"127.0.0.1:\d+", "127.0.0.1:" + str(port_websocket), line.decode("utf-8").rstrip())

            arguments_str = "<SEP>".join(arguments)

            if "--user-data-dir=" in arguments_str:
                user_data_dir = [arg for arg in arguments if "--user-data-dir=" in arg][0]
                devtools_file_path = os.path.join(user_data_dir.replace("--user-data-dir=", ""), "DevToolsActivePort")
                print(devtools_file_path)

                with open(devtools_file_path, "w") as devtools_file:
                    print("New port ", port_websocket)
                    devtools_file.write(str(port_websocket))
                    devtools_file.write("\n")
                    devtools_file.write('/devtools' + line.split('/devtools')[-1])

            print(line, file=sys.stderr)
            exit(0)


def launch_browser(browser_path, arguments, webclient_port):
    if not sys.platform.startswith('win'):
        exit(-1)

    p = subprocess.Popen([browser_path, *arguments], stdout=sys.stdout, stderr=subprocess.PIPE, creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)

    stderr_thread = threading.Thread(target=stderr_handler, args=(p, webclient_port, arguments))

    stderr_thread.start()


if __name__ == "__main__":
    logging.info("Start " + str(sys.argv))
    if len(sys.argv) > 1:
        browser_path = sys.argv[1]
        browser_arguments = sys.argv[2:]
        try:
            browser_arguments.remove("--enable-logging")
        except:
            pass

        if "remote-debugging-port=" in "".join(browser_arguments):
            port_websocket = " ".join(browser_arguments).split("remote-debugging-port=")[-1].split(" ")[0]

            if port_websocket == '0':
                port_websocket = get_free_port(2000)

            NEW_PORT = get_free_port(2000)
            browser_arguments = re.sub(r"remote-debugging-port=\d+", "remote-debugging-port=" + str(NEW_PORT),
                                       "<SEP>".join(browser_arguments)).split("<SEP>")

            logging.info('Starting chrome, websocket port = ' + str(port_websocket))
            launch_browser(browser_path, browser_arguments, port_websocket)
