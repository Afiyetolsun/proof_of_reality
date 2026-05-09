"""TCP forwarder: <oak host>:4000 → 10.0.0.1:4000 (gotee bridge over usb0).

The oakapp container can't see the OAK's usb0 interface (separate netns),
so we run this on the OAK host. The container reaches us via the host's
LAN IP, we relay to the Armory's bridge.

Half-close handling matters: when one side closes its write half we have
to shutdown the other side's read half rather than closing both sockets,
otherwise the response packet from gotee gets dropped before the client
reads it.

Usage on the OAK host:
    nohup python3 /tmp/forwarder.py > /tmp/fwd.log 2>&1 < /dev/null &
    echo $! > /tmp/fwd.pid

Restart with the same one-liner; kill -9 $(cat /tmp/fwd.pid) first.
"""

import socket
import threading


def relay(src, dst):
    try:
        while True:
            d = src.recv(4096)
            if not d:
                break
            dst.sendall(d)
    except Exception:
        pass
    try:
        dst.shutdown(socket.SHUT_WR)
    except Exception:
        pass


def handle(client):
    try:
        upstream = socket.create_connection(('10.0.0.1', 4000), timeout=5)
    except Exception as e:
        print('upstream connect fail:', e, flush=True)
        client.close()
        return
    t1 = threading.Thread(target=relay, args=(client, upstream), daemon=True)
    t2 = threading.Thread(target=relay, args=(upstream, client), daemon=True)
    t1.start()
    t2.start()
    t1.join()
    t2.join()
    for s in (client, upstream):
        try:
            s.close()
        except Exception:
            pass


def main():
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(('0.0.0.0', 4000))
    s.listen(8)
    print('forwarder listening on :4000', flush=True)
    while True:
        c, _addr = s.accept()
        threading.Thread(target=handle, args=(c,), daemon=True).start()


if __name__ == '__main__':
    main()
